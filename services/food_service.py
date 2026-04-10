from datetime import date, datetime, time
from typing import List, Optional

from psycopg.types.json import Jsonb

from data.database import get_connection


DEFAULT_MEAL_TIMES = {
    "lunch": time(hour=12, minute=30),
    "dinner": time(hour=19, minute=0),
    "brunch": time(hour=9, minute=30),
}
VALID_MEAL_TYPES = set(DEFAULT_MEAL_TIMES.keys())


def get_default_meal_time(meal_type: str) -> time:
    return DEFAULT_MEAL_TIMES[meal_type]


def normalize_food_row(row: Optional[dict]) -> Optional[dict]:
    if not row:
        return row

    normalized_row = dict(row)
    guest_names = normalized_row.get("guest_names")
    if isinstance(guest_names, list):
        normalized_row["guest_names"] = [str(name).strip() for name in guest_names if str(name).strip()]
    elif isinstance(guest_names, str):
        cleaned_name = guest_names.strip()
        normalized_row["guest_names"] = [cleaned_name] if cleaned_name else []
    else:
        normalized_row["guest_names"] = []

    normalized_row["guests"] = int(normalized_row.get("guests") or len(normalized_row["guest_names"]) or 0)
    normalized_row["cook_helper"] = bool(normalized_row.get("cook_helper"))
    normalized_row["cooks"] = bool(normalized_row.get("cooks"))
    normalized_row["eats"] = bool(normalized_row.get("eats"))
    normalized_row["take_leftovers_next_day"] = bool(normalized_row.get("take_leftovers_next_day"))
    normalized_row["updated_at"] = normalized_row.get("updated_at") or datetime.utcnow()
    return normalized_row


def validate_food_entry(
    house_id: int,
    person_id: int,
    meal_type: str,
    entry_date: date,
    cooking_group_name: Optional[str],
):
    if meal_type not in VALID_MEAL_TYPES:
        raise ValueError("Meal type must be lunch, dinner, or brunch")

    if meal_type == "brunch" and entry_date.weekday() != 6:
        raise ValueError("Brunch is only available on Sundays")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM people
                WHERE id = %s AND house_id = %s
                """,
                (person_id, house_id),
            )
            if not cur.fetchone():
                raise ValueError("Person does not belong to this house")


def create_or_update_food_entry(
    house_id: int,
    person_id: int,
    entry_date: date,
    meal_type: str,
    eats: bool,
    cooks: bool,
    cook_helper: bool,
    guest_names: List[str],
    take_leftovers_next_day: bool,
    eating_time: Optional[time],
    time_changed: bool,
    cooking_group_name: Optional[str],
    notes: Optional[str],
) -> dict:
    validate_food_entry(house_id, person_id, meal_type, entry_date, cooking_group_name)

    cleaned_notes = (notes or "").strip() or None
    normalized_group_name = (cooking_group_name or "").strip() or None
    if normalized_group_name == "Ganzes Haus":
        normalized_group_name = None
    normalized_guest_names = [name.strip() for name in (guest_names or []) if str(name).strip()]
    normalized_guests = len(normalized_guest_names)
    normalized_eats = bool(eats)
    normalized_cooks = bool(cooks) if normalized_eats else False
    normalized_helper = bool(cook_helper) if normalized_eats else False
    normalized_leftovers = bool(take_leftovers_next_day) if meal_type == "lunch" else False
    normalized_time = eating_time or get_default_meal_time(meal_type)

    if normalized_cooks and normalized_helper:
        raise ValueError("A person can only cook or help for a meal, not both")

    with get_connection() as con:
        with con.cursor() as cur:
            if normalized_cooks:
                cur.execute(
                    """
                    SELECT p.name
                    FROM food_entries AS fe
                    JOIN people AS p ON p.id = fe.person_id
                    WHERE fe.house_id = %s
                      AND fe.date = %s
                      AND fe.meal_type = %s
                      AND fe.cooks = TRUE
                      AND fe.person_id <> %s
                      AND fe.cooking_group_name IS NOT DISTINCT FROM %s
                    LIMIT 1
                    """,
                    (
                        house_id,
                        entry_date,
                        meal_type,
                        person_id,
                        normalized_group_name,
                    ),
                )
                existing_cook = cur.fetchone()
                if existing_cook:
                    raise ValueError(
                        f"{existing_cook['name']} already cooks for this meal and cooking group"
                    )

            cur.execute(
                """
                SELECT eating_time
                FROM food_meal_settings
                WHERE house_id = %s
                  AND date = %s
                  AND meal_type = %s
                  AND cooking_group_name IS NOT DISTINCT FROM %s
                """,
                (house_id, entry_date, meal_type, normalized_group_name),
            )
            existing_setting = cur.fetchone()
            effective_time = existing_setting["eating_time"] if existing_setting else normalized_time

            if time_changed or not existing_setting:
                effective_time = normalized_time
                cur.execute(
                    """
                    UPDATE food_meal_settings
                    SET eating_time = %s,
                        updated_at = NOW()
                    WHERE house_id = %s
                      AND date = %s
                      AND meal_type = %s
                      AND cooking_group_name IS NOT DISTINCT FROM %s
                    RETURNING id
                    """,
                    (
                        normalized_time,
                        house_id,
                        entry_date,
                        meal_type,
                        normalized_group_name,
                    ),
                )
                updated_setting = cur.fetchone()
                if not updated_setting:
                    cur.execute(
                        """
                        INSERT INTO food_meal_settings (
                            house_id,
                            date,
                            meal_type,
                            cooking_group_name,
                            eating_time,
                            updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, NOW())
                        """,
                        (
                            house_id,
                            entry_date,
                            meal_type,
                            normalized_group_name,
                            normalized_time,
                        ),
                    )

            cur.execute(
                """
                INSERT INTO food_entries (
                    house_id,
                    person_id,
                    date,
                    meal_type,
                    eats,
                    cooks,
                    cook_helper,
                    guests,
                    guest_names,
                    take_leftovers_next_day,
                    eating_time,
                    cooking_group_name,
                    cooking_group_id,
                    updated_at,
                    notes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s)
                ON CONFLICT (house_id, person_id, date, meal_type)
                DO UPDATE SET eats = EXCLUDED.eats,
                              cooks = EXCLUDED.cooks,
                              cook_helper = EXCLUDED.cook_helper,
                              guests = EXCLUDED.guests,
                              guest_names = EXCLUDED.guest_names,
                              take_leftovers_next_day = EXCLUDED.take_leftovers_next_day,
                              eating_time = EXCLUDED.eating_time,
                              cooking_group_name = EXCLUDED.cooking_group_name,
                              cooking_group_id = EXCLUDED.cooking_group_id,
                              updated_at = NOW(),
                              notes = EXCLUDED.notes
                RETURNING id
                """,
                (
                    house_id,
                    person_id,
                    entry_date,
                    meal_type,
                    normalized_eats,
                    normalized_cooks,
                    normalized_helper,
                    normalized_guests,
                    Jsonb(normalized_guest_names),
                    normalized_leftovers,
                    effective_time,
                    normalized_group_name,
                    None,
                    cleaned_notes,
                ),
            )
            row = cur.fetchone()
        con.commit()

    return get_food_entry_by_id(house_id, row["id"])


def get_food_entry_by_id(house_id: int, entry_id: int) -> dict:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT fe.id,
                       fe.house_id,
                       fe.person_id,
                       p.name AS person_name,
                       fe.date,
                       fe.meal_type,
                       fe.eats,
                       fe.cooks,
                       fe.cook_helper,
                       fe.guests,
                       COALESCE(fe.guest_names, '[]'::jsonb) AS guest_names,
                       fe.take_leftovers_next_day,
                       COALESCE(fms.eating_time, fe.eating_time) AS eating_time,
                       fe.cooking_group_id,
                       COALESCE(fe.cooking_group_name, lg.name) AS cooking_group_name,
                       COALESCE(fms.updated_at, fe.updated_at) AS updated_at,
                       fe.notes
                FROM food_entries AS fe
                JOIN people AS p ON p.id = fe.person_id
                LEFT JOIN living_groups AS lg ON lg.id = fe.cooking_group_id
                LEFT JOIN food_meal_settings AS fms
                  ON fms.house_id = fe.house_id
                 AND fms.date = fe.date
                 AND fms.meal_type = fe.meal_type
                 AND fms.cooking_group_name IS NOT DISTINCT FROM fe.cooking_group_name
                WHERE fe.house_id = %s AND fe.id = %s
                """,
                (house_id, entry_id),
            )
            return normalize_food_row(cur.fetchone())


def get_food_entries_by_date_range(
    house_id: int,
    start_date: date,
    end_date: date,
) -> List[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT fe.id,
                       fe.house_id,
                       fe.person_id,
                       p.name AS person_name,
                       fe.date,
                       fe.meal_type,
                       fe.eats,
                       fe.cooks,
                       fe.cook_helper,
                       fe.guests,
                       COALESCE(fe.guest_names, '[]'::jsonb) AS guest_names,
                       fe.take_leftovers_next_day,
                       COALESCE(fms.eating_time, fe.eating_time) AS eating_time,
                       fe.cooking_group_id,
                       COALESCE(fe.cooking_group_name, lg.name) AS cooking_group_name,
                       COALESCE(fms.updated_at, fe.updated_at) AS updated_at,
                       fe.notes
                FROM food_entries AS fe
                JOIN people AS p ON p.id = fe.person_id
                LEFT JOIN living_groups AS lg ON lg.id = fe.cooking_group_id
                LEFT JOIN food_meal_settings AS fms
                  ON fms.house_id = fe.house_id
                 AND fms.date = fe.date
                 AND fms.meal_type = fe.meal_type
                 AND fms.cooking_group_name IS NOT DISTINCT FROM fe.cooking_group_name
                WHERE fe.house_id = %s
                  AND fe.date BETWEEN %s AND %s
                ORDER BY fe.date, fe.meal_type, LOWER(p.name)
                """,
                (house_id, start_date, end_date),
            )
            return [normalize_food_row(row) for row in cur.fetchall()]


def get_food_summary(
    house_id: int,
    start_date: date,
    end_date: date,
) -> List[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT fe.date,
                       fe.meal_type,
                       COALESCE(SUM(CASE WHEN fe.eats THEN 1 + fe.guests ELSE 0 END), 0) AS total_eaters,
                       ARRAY_REMOVE(
                           ARRAY_AGG(
                               CASE WHEN fe.cooks THEN p.name ELSE NULL END
                               ORDER BY p.name
                           ),
                           NULL
                       ) AS cooks
                FROM food_entries AS fe
                JOIN people AS p ON p.id = fe.person_id
                WHERE fe.house_id = %s
                  AND fe.date BETWEEN %s AND %s
                GROUP BY fe.date, fe.meal_type
                ORDER BY fe.date, fe.meal_type
                """,
                (house_id, start_date, end_date),
            )
            return cur.fetchall()
