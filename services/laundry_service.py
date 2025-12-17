from typing import List, Dict
from datetime import date
from data.database import get_connection


def get_bookings() -> List[Dict]:
    """
    Return all laundry bookings as a list of dictionaries.

    PostgreSQL rows are returned as dicts via row_factory,
    so we can access columns by name.
    """
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT lb.id, lb.date, lb.slot, u.username AS user
                FROM laundry_bookings lb
                JOIN users u ON lb.user_id = u.id
                ORDER BY lb.date, lb.slot
                """
            )
            rows = cur.fetchall()

    return [
        {
            "id": row["id"],
            "date": row["date"],
            "slot": row["slot"],
            "user": row["user"],
        }
        for row in rows
    ]


def book_slot(date_: date, slot: str, user_id: int) -> bool:
    """
    Create a laundry booking for a given user_id.

    - Uses PostgreSQL parameter placeholders (%s)
    - Relies on database UNIQUE constraint for safety
    - Returns False if the slot is already booked
    """
    try:
        with get_connection() as con:
            with con.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO laundry_bookings (date, slot, user_id)
                    VALUES (%s, %s, %s)
                    """,
                    (date_, slot, user_id),
                )
        return True

    except Exception:
        # UNIQUE(date, slot) violation → slot already booked
        return False