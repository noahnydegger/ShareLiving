from typing import Optional

from data.database import get_connection


def list_chores(house_id: int) -> list[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT c.id,
                       c.house_id,
                       c.name,
                       c.location,
                       c.frequency,
                       c.effort,
                       c.description,
                       c.assigned_person_id,
                       p.name AS assigned_person_name
                FROM chores AS c
                LEFT JOIN people AS p
                  ON p.id = c.assigned_person_id
                WHERE c.house_id = %s
                ORDER BY LOWER(c.name), c.id
                """,
                (house_id,),
            )
            return cur.fetchall()


def get_chore(house_id: int, chore_id: int) -> Optional[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT c.id,
                       c.house_id,
                       c.name,
                       c.location,
                       c.frequency,
                       c.effort,
                       c.description,
                       c.assigned_person_id,
                       p.name AS assigned_person_name
                FROM chores AS c
                LEFT JOIN people AS p
                  ON p.id = c.assigned_person_id
                WHERE c.house_id = %s AND c.id = %s
                """,
                (house_id, chore_id),
            )
            return cur.fetchone()


def create_chore(
    house_id: int,
    name: str,
    location: Optional[str],
    frequency: Optional[str],
    effort: Optional[float],
    description: Optional[str],
) -> dict:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("Chore name is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chores (house_id, name, location, frequency, effort, description)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    house_id,
                    cleaned_name,
                    _normalize_optional_text(location),
                    _normalize_optional_text(frequency),
                    effort,
                    _normalize_optional_text(description),
                ),
            )
            chore = cur.fetchone()
        con.commit()
    return get_chore(house_id, chore["id"])


def update_chore(
    house_id: int,
    chore_id: int,
    name: str,
    location: Optional[str],
    frequency: Optional[str],
    effort: Optional[float],
    description: Optional[str],
) -> Optional[dict]:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("Chore name is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE chores
                SET name = %s,
                    location = %s,
                    frequency = %s,
                    effort = %s,
                    description = %s
                WHERE id = %s AND house_id = %s
                RETURNING id
                """,
                (
                    cleaned_name,
                    _normalize_optional_text(location),
                    _normalize_optional_text(frequency),
                    effort,
                    _normalize_optional_text(description),
                    chore_id,
                    house_id,
                ),
            )
            row = cur.fetchone()
        con.commit()
    if not row:
        return None
    return get_chore(house_id, row["id"])


def delete_chore(house_id: int, chore_id: int) -> bool:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                DELETE FROM chores
                WHERE id = %s AND house_id = %s
                """,
                (chore_id, house_id),
            )
            deleted = cur.rowcount
        con.commit()
    return deleted > 0


def assign_chore(house_id: int, chore_id: int, person_id: Optional[int]) -> Optional[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE chores
                SET assigned_person_id = %s
                WHERE id = %s AND house_id = %s
                RETURNING id
                """,
                (person_id, chore_id, house_id),
            )
            row = cur.fetchone()
        con.commit()
    if not row:
        return None
    return get_chore(house_id, row["id"])


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned_value = value.strip()
    return cleaned_value or None
