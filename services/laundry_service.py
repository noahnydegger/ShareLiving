from typing import List, Dict, Optional
from datetime import date, time
from data.database import get_connection


def get_bookings(house_id: int, person_id: Optional[int] = None) -> List[Dict]:
    """
    Return all laundry bookings as a list of dictionaries.

    PostgreSQL rows are returned as dicts via row_factory,
    so we can access columns by name.
    """
    with get_connection() as con:
        with con.cursor() as cur:
            if person_id is None:
                cur.execute(
                    """
                    SELECT lb.id, lb.person_id, lb.date, lb.start_time, lb.end_time, lb.duration_minutes,
                           COALESCE(p.name, u.username) AS person_name
                    FROM laundry_bookings lb
                    LEFT JOIN people p ON lb.person_id = p.id
                    LEFT JOIN users u ON lb.user_id = u.id
                    WHERE lb.house_id = %s
                    ORDER BY lb.date, lb.start_time
                    """,
                    (house_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT lb.id, lb.person_id, lb.date, lb.start_time, lb.end_time, lb.duration_minutes,
                           COALESCE(p.name, u.username) AS person_name
                    FROM laundry_bookings lb
                    LEFT JOIN people p ON lb.person_id = p.id
                    LEFT JOIN users u ON lb.user_id = u.id
                    WHERE lb.person_id = %s AND lb.house_id = %s
                    ORDER BY lb.date, lb.start_time
                    """,
                    (person_id, house_id),
                )
            rows = cur.fetchall()

    return [
        {
            "id": row["id"],
            "person_id": row["person_id"],
            "date": row["date"],
            "person_name": row["person_name"],
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
    person_id: int,
    house_id: int,
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
                        date, slot, start_time, end_time, duration_minutes, person_id, house_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        date_,
                        f"{start_time}-{end_time}",
                        start_time,
                        end_time,
                        duration_minutes,
                        person_id,
                        house_id,
                    ),
                )
        return True

    except Exception:
        # UNIQUE(date, slot) violation → slot already booked
        return False


def update_booking(
    booking_id: int,
    date_: date,
    start_time: time,
    end_time: time,
    duration_minutes: int,
    person_id: int,
    house_id: int,
) -> bool:
    try:
        with get_connection() as con:
            with con.cursor() as cur:
                cur.execute(
                    """
                    UPDATE laundry_bookings
                    SET date = %s,
                        slot = %s,
                        start_time = %s,
                        end_time = %s,
                        duration_minutes = %s,
                        person_id = %s
                    WHERE id = %s AND house_id = %s
                    """,
                    (
                        date_,
                        f"{start_time}-{end_time}",
                        start_time,
                        end_time,
                        duration_minutes,
                        person_id,
                        booking_id,
                        house_id,
                    ),
                )
                updated = cur.rowcount
        return updated > 0
    except Exception:
        return False


def delete_booking(booking_id: int, house_id: int) -> bool:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                DELETE FROM laundry_bookings
                WHERE id = %s AND house_id = %s
                """,
                (booking_id, house_id),
            )
            deleted = cur.rowcount
        con.commit()
    return deleted > 0
