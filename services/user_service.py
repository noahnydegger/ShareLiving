from typing import Optional

from data.database import get_connection


def get_or_create_user_id(username: str) -> int:
    cleaned = username.strip()
    if not cleaned:
        raise ValueError("Username is required")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM users
                WHERE username = %s
                """,
                (cleaned,),
            )
            row = cur.fetchone()
            if row:
                return row["id"]

            cur.execute(
                """
                INSERT INTO users (email, hashed_password, username)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (f"{cleaned}@local.test", "disabled", cleaned),
            )
            return cur.fetchone()["id"]


def get_user_id(username: str) -> Optional[int]:
    cleaned = username.strip()
    if not cleaned:
        return None

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM users
                WHERE username = %s
                """,
                (cleaned,),
            )
            row = cur.fetchone()
            return row["id"] if row else None
