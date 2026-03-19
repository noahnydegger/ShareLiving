from datetime import date, datetime, time
from typing import Dict, List, Optional

from data.database import get_connection


VALID_MACHINES = {"1", "2", "1 und 2"}


def _row_to_booking(row: dict) -> dict:
    return {
        "id": row["id"],
        "person_id": row["person_id"],
        "date": row["date"],
        "person_name": row["person_name"],
        "machine": row["machine"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "duration_minutes": row["duration_minutes"],
    }


def _machine_overlaps(selected_machine: str, booked_machine: str) -> bool:
    if selected_machine == "1 und 2" or booked_machine == "1 und 2":
        return True
    return selected_machine == booked_machine


def get_bookings(house_id: int, person_id: Optional[int] = None) -> List[Dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            if person_id is None:
                cur.execute(
                    """
                    SELECT lb.id,
                           COALESCE(lb.person_id, legacy_p.id) AS person_id,
                           lb.date,
                           lb.machine,
                           lb.start_time,
                           lb.end_time,
                           lb.duration_minutes,
                           COALESCE(p.name, legacy_p.name, u.username) AS person_name
                    FROM laundry_bookings lb
                    LEFT JOIN people p ON lb.person_id = p.id
                    LEFT JOIN users u ON lb.user_id = u.id
                    LEFT JOIN people legacy_p
                      ON legacy_p.house_id = lb.house_id
                     AND LOWER(legacy_p.name) = LOWER(u.username)
                    WHERE lb.house_id = %s
                    ORDER BY lb.date, lb.start_time
                    """,
                    (house_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT lb.id,
                           COALESCE(lb.person_id, legacy_p.id) AS person_id,
                           lb.date,
                           lb.machine,
                           lb.start_time,
                           lb.end_time,
                           lb.duration_minutes,
                           COALESCE(p.name, legacy_p.name, u.username) AS person_name
                    FROM laundry_bookings lb
                    LEFT JOIN people p ON lb.person_id = p.id
                    LEFT JOIN users u ON lb.user_id = u.id
                    LEFT JOIN people legacy_p
                      ON legacy_p.house_id = lb.house_id
                     AND LOWER(legacy_p.name) = LOWER(u.username)
                    WHERE COALESCE(lb.person_id, legacy_p.id) = %s AND lb.house_id = %s
                    ORDER BY lb.date, lb.start_time
                    """,
                    (person_id, house_id),
                )
            rows = cur.fetchall()

    return [_row_to_booking(row) for row in rows]


def get_upcoming_bookings(house_id: int, limit: int = 10, offset: int = 0) -> dict:
    today = datetime.now().date()
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT lb.id,
                       COALESCE(lb.person_id, legacy_p.id) AS person_id,
                       lb.date,
                       lb.machine,
                       lb.start_time,
                       lb.end_time,
                       lb.duration_minutes,
                       COALESCE(p.name, legacy_p.name, u.username) AS person_name
                FROM laundry_bookings lb
                LEFT JOIN people p ON lb.person_id = p.id
                LEFT JOIN users u ON lb.user_id = u.id
                LEFT JOIN people legacy_p
                  ON legacy_p.house_id = lb.house_id
                 AND LOWER(legacy_p.name) = LOWER(u.username)
                WHERE lb.house_id = %s
                  AND lb.date >= %s
                ORDER BY lb.date, lb.start_time, lb.id
                OFFSET %s
                LIMIT %s
                """,
                (house_id, today, offset, limit + 1),
            )
            rows = cur.fetchall()

    items = [_row_to_booking(row) for row in rows[:limit]]
    return {
        "items": items,
        "offset": offset,
        "limit": limit,
        "has_previous": offset > 0,
        "has_next": len(rows) > limit,
    }


def has_machine_overlap(
    house_id: int,
    date_: date,
    start_time: time,
    end_time: time,
    machine: str,
    exclude_booking_id: Optional[int] = None,
) -> bool:
    with get_connection() as con:
        with con.cursor() as cur:
            if exclude_booking_id is None:
                cur.execute(
                    """
                    SELECT machine
                    FROM laundry_bookings
                    WHERE house_id = %s
                      AND date = %s
                      AND start_time < %s
                      AND end_time > %s
                    """,
                    (house_id, date_, end_time, start_time),
                )
            else:
                cur.execute(
                    """
                    SELECT machine
                    FROM laundry_bookings
                    WHERE house_id = %s
                      AND date = %s
                      AND start_time < %s
                      AND end_time > %s
                      AND id <> %s
                    """,
                    (house_id, date_, end_time, start_time, exclude_booking_id),
                )
            rows = cur.fetchall()

    return any(_machine_overlaps(machine, row["machine"]) for row in rows)


def book_slot(
    date_: date,
    start_time: time,
    end_time: time,
    duration_minutes: int,
    person_id: int,
    house_id: int,
    machine: str,
) -> bool:
    if machine not in VALID_MACHINES:
        return False
    if has_machine_overlap(house_id, date_, start_time, end_time, machine):
        return False

    try:
        with get_connection() as con:
            with con.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO laundry_bookings (
                        date, slot, start_time, end_time, duration_minutes, person_id, house_id, machine
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        date_,
                        f"{start_time}-{end_time}",
                        start_time,
                        end_time,
                        duration_minutes,
                        person_id,
                        house_id,
                        machine,
                    ),
                )
            con.commit()
        return True
    except Exception:
        return False


def update_booking(
    booking_id: int,
    date_: date,
    start_time: time,
    end_time: time,
    duration_minutes: int,
    person_id: int,
    house_id: int,
    machine: str,
) -> bool:
    if machine not in VALID_MACHINES:
        return False
    if has_machine_overlap(house_id, date_, start_time, end_time, machine, exclude_booking_id=booking_id):
        return False

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
                        person_id = %s,
                        machine = %s
                    WHERE id = %s AND house_id = %s
                    """,
                    (
                        date_,
                        f"{start_time}-{end_time}",
                        start_time,
                        end_time,
                        duration_minutes,
                        person_id,
                        machine,
                        booking_id,
                        house_id,
                    ),
                )
                updated = cur.rowcount
            con.commit()
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
