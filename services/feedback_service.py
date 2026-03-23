from typing import Optional

from data.database import get_connection


def list_feedback(house_id: int) -> list[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT f.id,
                       f.house_id,
                       f.person_id,
                       p.name AS person_name,
                       f.area,
                       f.feedback_type,
                       f.description,
                       f.priority,
                       f.resolved,
                       f.created_at
                FROM feedback AS f
                JOIN people AS p
                  ON p.id = f.person_id
                WHERE f.house_id = %s
                ORDER BY f.created_at DESC, f.id DESC
                """,
                (house_id,),
            )
            return cur.fetchall()


def get_feedback_item(house_id: int, feedback_id: int) -> Optional[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT f.id,
                       f.house_id,
                       f.person_id,
                       p.name AS person_name,
                       f.area,
                       f.feedback_type,
                       f.description,
                       f.priority,
                       f.resolved,
                       f.created_at
                FROM feedback AS f
                JOIN people AS p
                  ON p.id = f.person_id
                WHERE f.house_id = %s AND f.id = %s
                """,
                (house_id, feedback_id),
            )
            return cur.fetchone()


def create_feedback_item(
    house_id: int,
    person_id: int,
    area: str,
    feedback_type: str,
    description: str,
    priority: str,
) -> dict:
    cleaned_area = _required_text(area, "Area is required")
    cleaned_description = _required_text(description, "Description is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO feedback (
                    house_id,
                    person_id,
                    area,
                    feedback_type,
                    description,
                    priority
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    house_id,
                    person_id,
                    cleaned_area,
                    feedback_type,
                    cleaned_description,
                    priority,
                ),
            )
            row = cur.fetchone()
        con.commit()
    return get_feedback_item(house_id, row["id"])


def set_feedback_resolved(house_id: int, feedback_id: int, resolved: bool) -> Optional[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE feedback
                SET resolved = %s
                WHERE id = %s AND house_id = %s
                RETURNING id
                """,
                (resolved, feedback_id, house_id),
            )
            row = cur.fetchone()
        con.commit()
    if not row:
        return None
    return get_feedback_item(house_id, row["id"])


def _required_text(value: str, message: str) -> str:
    cleaned_value = str(value or "").strip()
    if not cleaned_value:
        raise ValueError(message)
    return cleaned_value
