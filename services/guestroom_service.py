from datetime import datetime
from typing import Dict, List, Optional

from data.database import get_connection


def _row_to_booking(row: dict) -> dict:
    return {
        "id": row["id"],
        "person_id": row["person_id"],
        "guest_room_id": row["guest_room_id"],
        "responsible_name": row["responsible_name"],
        "guest_name": row["guest_name"],
        "room_name": row["room_name"],
        "start_at": row["start_at"],
        "end_at": row["end_at"],
        "duration_minutes": row["duration_minutes"],
    }


def get_bookings(house_id: int) -> List[Dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT gb.id,
                       p.id AS person_id,
                       gb.guest_room_id,
                       p.name AS responsible_name,
                       gb.guest_name,
                       gb.room_name,
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

    return [_row_to_booking(row) for row in rows]


def get_upcoming_bookings(house_id: int, limit: int = 10, offset: int = 0) -> dict:
    today = datetime.now().date()
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT gb.id,
                       p.id AS person_id,
                       gb.guest_room_id,
                       p.name AS responsible_name,
                       gb.guest_name,
                       gb.room_name,
                       gb.start_at,
                       gb.end_at,
                       gb.duration_minutes
                FROM guestroom_bookings gb
                JOIN people p ON gb.person_id = p.id
                WHERE gb.house_id = %s
                  AND gb.end_at::date >= %s
                ORDER BY gb.start_at, gb.id
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


def get_room_conflicts(
    house_id: int,
    person_id: int,
    guest_room_id: Optional[int],
    start_at: datetime,
    end_at: datetime,
    exclude_booking_id: Optional[int] = None,
) -> List[Dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            if guest_room_id is None:
                if exclude_booking_id is None:
                    cur.execute(
                        """
                        SELECT gb.id,
                               p.name AS responsible_name,
                               gb.room_name,
                               gb.start_at,
                               gb.end_at
                        FROM guestroom_bookings gb
                        JOIN people p ON gb.person_id = p.id
                        WHERE gb.house_id = %s
                          AND gb.person_id = %s
                          AND gb.guest_room_id IS NULL
                          AND gb.start_at < %s
                          AND gb.end_at > %s
                        ORDER BY gb.start_at
                        """,
                        (house_id, person_id, end_at, start_at),
                    )
                else:
                    cur.execute(
                        """
                        SELECT gb.id,
                               p.name AS responsible_name,
                               gb.room_name,
                               gb.start_at,
                               gb.end_at
                        FROM guestroom_bookings gb
                        JOIN people p ON gb.person_id = p.id
                        WHERE gb.house_id = %s
                          AND gb.person_id = %s
                          AND gb.guest_room_id IS NULL
                          AND gb.start_at < %s
                          AND gb.end_at > %s
                          AND gb.id <> %s
                        ORDER BY gb.start_at
                        """,
                        (house_id, person_id, end_at, start_at, exclude_booking_id),
                    )
            else:
                if exclude_booking_id is None:
                    cur.execute(
                        """
                        SELECT gb.id,
                               p.name AS responsible_name,
                               gb.room_name,
                               gb.start_at,
                               gb.end_at
                        FROM guestroom_bookings gb
                        JOIN people p ON gb.person_id = p.id
                        WHERE gb.house_id = %s
                          AND gb.guest_room_id = %s
                          AND gb.start_at < %s
                          AND gb.end_at > %s
                        ORDER BY gb.start_at
                        """,
                        (house_id, guest_room_id, end_at, start_at),
                    )
                else:
                    cur.execute(
                        """
                        SELECT gb.id,
                               p.name AS responsible_name,
                               gb.room_name,
                               gb.start_at,
                               gb.end_at
                        FROM guestroom_bookings gb
                        JOIN people p ON gb.person_id = p.id
                        WHERE gb.house_id = %s
                          AND gb.guest_room_id = %s
                          AND gb.start_at < %s
                          AND gb.end_at > %s
                          AND gb.id <> %s
                        ORDER BY gb.start_at
                        """,
                        (house_id, guest_room_id, end_at, start_at, exclude_booking_id),
                    )
            return cur.fetchall()


def add_booking(
    house_id: int,
    person_id: int,
    guest_room_id: Optional[int],
    guest_name: str,
    room_name: str,
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
                        guest_room_id,
                        guest_name,
                        room_name,
                        start_at,
                        end_at,
                        duration_minutes
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        house_id,
                        person_id,
                        guest_room_id,
                        guest_name,
                        room_name,
                        start_at,
                        end_at,
                        duration_minutes,
                    ),
                )
        return True
    except Exception:
        return False


def update_booking(
    booking_id: int,
    house_id: int,
    person_id: int,
    guest_room_id: Optional[int],
    guest_name: str,
    room_name: str,
    start_at: datetime,
    end_at: datetime,
    duration_minutes: int,
) -> bool:
    try:
        with get_connection() as con:
            with con.cursor() as cur:
                cur.execute(
                    """
                    UPDATE guestroom_bookings
                    SET person_id = %s,
                        guest_room_id = %s,
                        guest_name = %s,
                        room_name = %s,
                        start_at = %s,
                        end_at = %s,
                        duration_minutes = %s
                    WHERE id = %s AND house_id = %s
                    """,
                    (
                        person_id,
                        guest_room_id,
                        guest_name,
                        room_name,
                        start_at,
                        end_at,
                        duration_minutes,
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
                DELETE FROM guestroom_bookings
                WHERE id = %s AND house_id = %s
                """,
                (booking_id, house_id),
            )
            deleted = cur.rowcount
        con.commit()
    return deleted > 0
