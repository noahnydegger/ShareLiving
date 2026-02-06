from typing import List, Dict, Optional
from datetime import date, time
from data.database import get_connection


def get_bookings(user_id: Optional[int] = None) -> List[Dict]:
    """
    Return all laundry bookings as a list of dictionaries.

    PostgreSQL rows are returned as dicts via row_factory,
    so we can access columns by name.
    """
    with get_connection() as con:
        with con.cursor() as cur:
            if user_id is None:
                cur.execute(
                    """
                    SELECT lb.id, lb.date, lb.start_time, lb.end_time, lb.duration_minutes,
                           u.username AS user
                    FROM laundry_bookings lb
                    JOIN users u ON lb.user_id = u.id
                    ORDER BY lb.date, lb.start_time
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT lb.id, lb.date, lb.start_time, lb.end_time, lb.duration_minutes,
                           u.username AS user
                    FROM laundry_bookings lb
                    JOIN users u ON lb.user_id = u.id
                    WHERE lb.user_id = %s
                    ORDER BY lb.date, lb.start_time
                    """,
                    (user_id,),
                )
            rows = cur.fetchall()

    return [
        {
            "id": row["id"],
            "date": row["date"],
            "user": row["user"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "duration_minutes": row["duration_minutes"],
        }
        for row in rows
    ]


def book_slot(
    date_: date,
    start_time: time,
    end_time: time,
    duration_minutes: int,
    user_id: int,
) -> bool:
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
                    INSERT INTO laundry_bookings (
                        date, slot, start_time, end_time, duration_minutes, user_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        date_,
                        f"{start_time}-{end_time}",
                        start_time,
                        end_time,
                        duration_minutes,
                        user_id,
                    ),
                )
        return True

    except Exception:
        # UNIQUE(date, slot) violation → slot already booked
        return False
