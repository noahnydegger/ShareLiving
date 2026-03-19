from datetime import datetime
from typing import Dict, List

from data.database import get_connection


def get_bookings(house_id: int) -> List[Dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT gb.id,
                       p.id AS person_id,
                       p.name AS responsible_name,
                       gb.guest_name,
                       gb.start_at,
                       gb.end_at,
                       gb.duration_minutes
                FROM guestroom_bookings gb
                JOIN people p ON gb.person_id = p.id
                WHERE gb.house_id = %s
                ORDER BY gb.start_at
                """,
                (house_id,),
            )
            rows = cur.fetchall()

    return [
        {
            "id": row["id"],
            "person_id": row["person_id"],
            "responsible_name": row["responsible_name"],
            "guest_name": row["guest_name"],
            "start_at": row["start_at"],
            "end_at": row["end_at"],
            "duration_minutes": row["duration_minutes"],
        }
        for row in rows
    ]


def add_booking(
    house_id: int,
    person_id: int,
    guest_name: str,
    start_at: datetime,
    end_at: datetime,
    duration_minutes: int,
) -> bool:
    try:
        with get_connection() as con:
            with con.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO guestroom_bookings (
                        house_id,
                        person_id,
                        guest_name,
                        start_at,
                        end_at,
                        duration_minutes
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        house_id,
                        person_id,
                        guest_name,
                        start_at,
                        end_at,
                        duration_minutes,
                    ),
                )
        return True
    except Exception:
        return False
