from datetime import date, datetime, time
from typing import Any, List, Optional

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


def _normalize_entry(entry: dict[str, Any]) -> dict[str, Any]:
    meal_type = entry["meal_type"]
    entry_date = entry.get("entry_date") or entry.get("date")
    if not entry_date:
        raise ValueError("Date is required")
    if meal_type not in VALID_MEAL_TYPES:
        raise ValueError("Meal type must be lunch, dinner, or brunch")
    if meal_type == "brunch" and entry_date.weekday() != 6:
        raise ValueError("Brunch is only available on Sundays")

    normalized_group_name = (entry.get("cooking_group_name") or "").strip() or None
    if normalized_group_name == "Ganzes Haus":
        normalized_group_name = None
    normalized_guest_names = [
        str(name).strip() for name in (entry.get("guest_names") or []) if str(name).strip()
    ]
    normalized_eats = bool(entry.get("eats"))
    normalized_cooks = bool(entry.get("cooks")) if normalized_eats else False
    normalized_helper = bool(entry.get("cook_helper")) if normalized_eats else False
    if normalized_cooks and normalized_helper:
        raise ValueError("A person can only cook or help for a meal, not both")

    return {
        **entry,
        "entry_date": entry_date,
        "cooking_group_name": normalized_group_name,
        "guest_names": normalized_guest_names,
        "guests": len(normalized_guest_names),
        "eats": normalized_eats,
        "cooks": normalized_cooks,
        "cook_helper": normalized_helper,
        "take_leftovers_next_day": bool(entry.get("take_leftovers_next_day"))
        if meal_type == "lunch"
        else False,
        "eating_time": entry.get("eating_time") or get_default_meal_time(meal_type),
        "notes": (entry.get("notes") or "").strip() or None,
    }


def _save_food_entry(cur, house_id: int, entry: dict[str, Any]) -> int:
    if entry["cooks"]:
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
                entry["entry_date"],
                entry["meal_type"],
                entry["person_id"],
                entry["cooking_group_name"],
            ),
        )
        existing_cook = cur.fetchone()
        if existing_cook:
            raise ValueError(f"{existing_cook['name']} already cooks for this meal and cooking group")

    cur.execute(
        """
        SELECT eating_time
        FROM food_meal_settings
        WHERE house_id = %s
          AND date = %s
          AND meal_type = %s
          AND cooking_group_name IS NOT DISTINCT FROM %s
        """,
        (house_id, entry["entry_date"], entry["meal_type"], entry["cooking_group_name"]),
    )
    existing_setting = cur.fetchone()
    effective_time = existing_setting["eating_time"] if existing_setting else entry["eating_time"]

    if entry.get("time_changed") or not existing_setting:
        effective_time = entry["eating_time"]
        cur.execute(
            """
            UPDATE food_meal_settings
            SET eating_time = %s, updated_at = NOW()
            WHERE house_id = %s
              AND date = %s
              AND meal_type = %s
              AND cooking_group_name IS NOT DISTINCT FROM %s
            RETURNING id
            """,
            (
                entry["eating_time"],
                house_id,
                entry["entry_date"],
                entry["meal_type"],
                entry["cooking_group_name"],
            ),
        )
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO food_meal_settings (
                    house_id, date, meal_type, cooking_group_name, eating_time, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, NOW())
                """,
                (
                    house_id,
                    entry["entry_date"],
                    entry["meal_type"],
                    entry["cooking_group_name"],
                    entry["eating_time"],
                ),
            )

    cur.execute(
        """
        INSERT INTO food_entries (
            house_id, person_id, date, meal_type, eats, cooks, cook_helper, guests,
            guest_names, take_leftovers_next_day, eating_time, cooking_group_name,
            cooking_group_id, updated_at, notes
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
            entry["person_id"],
            entry["entry_date"],
            entry["meal_type"],
            entry["eats"],
            entry["cooks"],
            entry["cook_helper"],
            entry["guests"],
            Jsonb(entry["guest_names"]),
            entry["take_leftovers_next_day"],
            effective_time,
            entry["cooking_group_name"],
            None,
            entry["notes"],
        ),
    )
    return cur.fetchone()["id"]


def create_or_update_food_entries(house_id: int, entries: List[dict[str, Any]]) -> int:
    if not entries:
        raise ValueError("At least one food entry is required")

    normalized_entries = [_normalize_entry(entry) for entry in entries]
    person_ids = sorted({entry["person_id"] for entry in normalized_entries})
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                "SELECT id FROM people WHERE house_id = %s AND id = ANY(%s)",
                (house_id, person_ids),
            )
            valid_person_ids = {row["id"] for row in cur.fetchall()}
            if valid_person_ids != set(person_ids):
                raise ValueError("Person does not belong to this house")
            for entry in normalized_entries:
                _save_food_entry(cur, house_id, entry)
        con.commit()
    return len(normalized_entries)


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
    entry = _normalize_entry(
        {
            "person_id": person_id,
            "entry_date": entry_date,
            "meal_type": meal_type,
            "eats": eats,
            "cooks": cooks,
            "cook_helper": cook_helper,
            "guest_names": guest_names,
            "take_leftovers_next_day": take_leftovers_next_day,
            "eating_time": eating_time,
            "time_changed": time_changed,
            "cooking_group_name": cooking_group_name,
            "notes": notes,
        }
    )
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                "SELECT id FROM people WHERE id = %s AND house_id = %s",
                (person_id, house_id),
            )
            if not cur.fetchone():
                raise ValueError("Person does not belong to this house")
            entry_id = _save_food_entry(cur, house_id, entry)
        con.commit()
    return get_food_entry_by_id(house_id, entry_id)


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
                       COALESCE(
                           SUM((CASE WHEN fe.eats THEN 1 ELSE 0 END) + fe.guests),
                           0
                       ) AS total_eaters,
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
