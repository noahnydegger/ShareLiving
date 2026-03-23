from datetime import date
from typing import Optional

from data.database import get_connection


def list_defects(house_id: int) -> list[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT d.id,
                       d.house_id,
                       d.person_id,
                       p.name AS person_name,
                       d.room,
                       d.room_location,
                       d.description,
                       d.damage_source,
                       d.resolution_type,
                       d.photo_available,
                       d.reported_date,
                       d.officially_resolved,
                       d.created_at
                FROM defects AS d
                JOIN people AS p
                  ON p.id = d.person_id
                WHERE d.house_id = %s
                ORDER BY d.reported_date DESC, d.id DESC
                """,
                (house_id,),
            )
            return cur.fetchall()


def get_defect(house_id: int, defect_id: int) -> Optional[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT d.id,
                       d.house_id,
                       d.person_id,
                       p.name AS person_name,
                       d.room,
                       d.room_location,
                       d.description,
                       d.damage_source,
                       d.resolution_type,
                       d.photo_available,
                       d.reported_date,
                       d.officially_resolved,
                       d.created_at
                FROM defects AS d
                JOIN people AS p
                  ON p.id = d.person_id
                WHERE d.house_id = %s AND d.id = %s
                """,
                (house_id, defect_id),
            )
            return cur.fetchone()


def create_defect(
    house_id: int,
    person_id: int,
    room: str,
    room_location: str,
    description: str,
    damage_source: str,
    resolution_type: str,
    photo_available: bool,
    reported_date: date,
) -> dict:
    cleaned_room = _required_text(room, "Room is required")
    cleaned_room_location = _required_text(room_location, "Room location is required")
    cleaned_description = _required_text(description, "Description is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO defects (
                    house_id,
                    person_id,
                    room,
                    room_location,
                    description,
                    damage_source,
                    resolution_type,
                    photo_available,
                    reported_date
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    house_id,
                    person_id,
                    cleaned_room,
                    cleaned_room_location,
                    cleaned_description,
                    damage_source,
                    resolution_type,
                    photo_available,
                    reported_date,
                ),
            )
            row = cur.fetchone()
        con.commit()
    return get_defect(house_id, row["id"])


def set_defect_resolved(house_id: int, defect_id: int, officially_resolved: bool) -> Optional[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE defects
                SET officially_resolved = %s
                WHERE id = %s AND house_id = %s
                RETURNING id
                """,
                (officially_resolved, defect_id, house_id),
            )
            row = cur.fetchone()
        con.commit()
    if not row:
        return None
    return get_defect(house_id, row["id"])


def get_defect_photo_link(house_id: int) -> Optional[str]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT defect_photo_link
                FROM houses
                WHERE id = %s
                """,
                (house_id,),
            )
            row = cur.fetchone()
    return row["defect_photo_link"] if row else None


def set_defect_photo_link(house_id: int, photo_link: Optional[str]) -> Optional[str]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE houses
                SET defect_photo_link = %s
                WHERE id = %s
                RETURNING defect_photo_link
                """,
                (_normalize_optional_text(photo_link), house_id),
            )
            row = cur.fetchone()
        con.commit()
    return row["defect_photo_link"] if row else None


def _required_text(value: str, message: str) -> str:
    cleaned_value = str(value or "").strip()
    if not cleaned_value:
        raise ValueError(message)
    return cleaned_value


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned_value = value.strip()
    return cleaned_value or None
