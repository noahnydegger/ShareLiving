from typing import Optional

from data.database import get_connection


def list_living_groups(house_id: int) -> list[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id, house_id, name
                FROM living_groups
                WHERE house_id = %s
                ORDER BY LOWER(name), id
                """,
                (house_id,),
            )
            return cur.fetchall()


def create_living_group(house_id: int, name: str) -> dict:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("Living group name is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO living_groups (house_id, name)
                VALUES (%s, %s)
                RETURNING id, house_id, name
                """,
                (house_id, cleaned_name),
            )
            living_group = cur.fetchone()
        con.commit()
    return living_group


def update_living_group(house_id: int, living_group_id: int, name: str) -> Optional[dict]:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("Living group name is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE living_groups
                SET name = %s
                WHERE id = %s AND house_id = %s
                RETURNING id, house_id, name
                """,
                (cleaned_name, living_group_id, house_id),
            )
            living_group = cur.fetchone()
        con.commit()
    return living_group


def delete_living_group(house_id: int, living_group_id: int) -> bool:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                DELETE FROM living_groups
                WHERE id = %s AND house_id = %s
                """,
                (living_group_id, house_id),
            )
            deleted = cur.rowcount
        con.commit()
    return deleted > 0


def list_guest_rooms(house_id: int) -> list[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id, house_id, name
                FROM guest_rooms
                WHERE house_id = %s
                ORDER BY LOWER(name), id
                """,
                (house_id,),
            )
            return cur.fetchall()


def create_guest_room(house_id: int, name: str) -> dict:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("Guest room name is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO guest_rooms (house_id, name)
                VALUES (%s, %s)
                RETURNING id, house_id, name
                """,
                (house_id, cleaned_name),
            )
            guest_room = cur.fetchone()
        con.commit()
    return guest_room


def update_guest_room(house_id: int, guest_room_id: int, name: str) -> Optional[dict]:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("Guest room name is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE guest_rooms
                SET name = %s
                WHERE id = %s AND house_id = %s
                RETURNING id, house_id, name
                """,
                (cleaned_name, guest_room_id, house_id),
            )
            guest_room = cur.fetchone()
        con.commit()
    return guest_room


def delete_guest_room(house_id: int, guest_room_id: int) -> bool:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                DELETE FROM guest_rooms
                WHERE id = %s AND house_id = %s
                """,
                (guest_room_id, house_id),
            )
            deleted = cur.rowcount
        con.commit()
    return deleted > 0


def list_people(house_id: int) -> list[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT p.id,
                       p.house_id,
                       p.name,
                       p.living_group_id,
                       lg.name AS living_group_name
                FROM people AS p
                LEFT JOIN living_groups AS lg
                  ON lg.id = p.living_group_id
                WHERE p.house_id = %s
                ORDER BY LOWER(p.name), p.id
                """,
                (house_id,),
            )
            return cur.fetchall()


def get_person(house_id: int, person_id: int) -> Optional[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT p.id,
                       p.house_id,
                       p.name,
                       p.living_group_id,
                       lg.name AS living_group_name
                FROM people AS p
                LEFT JOIN living_groups AS lg
                  ON lg.id = p.living_group_id
                WHERE p.house_id = %s AND p.id = %s
                """,
                (house_id, person_id),
            )
            return cur.fetchone()


def create_person(house_id: int, name: str, living_group_id: Optional[int]) -> dict:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("Person name is required")

    if living_group_id is not None:
        with get_connection() as con:
            with con.cursor() as cur:
                cur.execute(
                    """
                    SELECT id
                    FROM living_groups
                    WHERE id = %s AND house_id = %s
                    """,
                    (living_group_id, house_id),
                )
                if not cur.fetchone():
                    raise ValueError("Living group does not belong to this house")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO people (house_id, name, living_group_id)
                VALUES (%s, %s, %s)
                RETURNING id, house_id, name, living_group_id
                """,
                (house_id, cleaned_name, living_group_id),
            )
            person = cur.fetchone()
        con.commit()

    return get_person(house_id, person["id"])


def update_person(house_id: int, person_id: int, name: str, living_group_id: Optional[int]) -> Optional[dict]:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("Person name is required")

    if living_group_id is not None:
        with get_connection() as con:
            with con.cursor() as cur:
                cur.execute(
                    """
                    SELECT id
                    FROM living_groups
                    WHERE id = %s AND house_id = %s
                    """,
                    (living_group_id, house_id),
                )
                if not cur.fetchone():
                    raise ValueError("Living group does not belong to this house")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE people
                SET name = %s,
                    living_group_id = %s
                WHERE id = %s AND house_id = %s
                RETURNING id
                """,
                (cleaned_name, living_group_id, person_id, house_id),
            )
            row = cur.fetchone()
        con.commit()

    if not row:
        return None
    return get_person(house_id, row["id"])


def delete_person(house_id: int, person_id: int) -> bool:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                DELETE FROM people
                WHERE id = %s AND house_id = %s
                """,
                (person_id, house_id),
            )
            deleted = cur.rowcount
        con.commit()
    return deleted > 0
