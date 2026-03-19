import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

from data.database import get_connection, get_house_by_id


TOKEN_SECRET = os.getenv("HOUSE_TOKEN_SECRET", "shareliving-dev-secret")
TOKEN_VERSION = 1
HOUSE_TOKEN_TTL_SECONDS = int(os.getenv("HOUSE_TOKEN_TTL_SECONDS", str(7 * 24 * 60 * 60)))


def _urlsafe_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _urlsafe_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_house_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return f"{salt}${digest.hex()}"


def verify_house_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected = stored_hash.split("$", 1)
    except ValueError:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return hmac.compare_digest(digest.hex(), expected)


def _slugify_house_name(name: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in name.strip())
    compact = "-".join(part for part in cleaned.split("-") if part)
    return compact or "house"


def _build_unique_slug(name: str) -> str:
    base_slug = _slugify_house_name(name)
    slug = base_slug
    counter = 2

    with get_connection() as con:
        with con.cursor() as cur:
            while True:
                cur.execute(
                    """
                    SELECT 1
                    FROM houses
                    WHERE slug = %s
                    """,
                    (slug,),
                )
                if not cur.fetchone():
                    return slug
                slug = f"{base_slug}-{counter}"
                counter += 1


def create_house(name: str, password: str) -> dict:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise ValueError("House name is required")
    if len(password) < 4:
        raise ValueError("House password must be at least 4 characters")

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM houses
                WHERE LOWER(name) = LOWER(%s)
                """,
                (cleaned_name,),
            )
            if cur.fetchone():
                raise ValueError("House name already exists")

            cur.execute(
                """
                INSERT INTO houses (slug, name, password_hash)
                VALUES (%s, %s, %s)
                RETURNING id, slug, name, session_version
                """,
                (
                    _build_unique_slug(cleaned_name),
                    cleaned_name,
                    hash_house_password(password),
                ),
            )
            house = cur.fetchone()
        con.commit()
    return house


def login_house(name: str, password: str) -> Optional[dict]:
    cleaned_name = name.strip()
    if not cleaned_name or not password:
        return None

    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id, slug, name, password_hash, session_version
                FROM houses
                WHERE LOWER(name) = LOWER(%s)
                """,
                (cleaned_name,),
            )
            house = cur.fetchone()

    if not house or not house["password_hash"]:
        return None
    if not verify_house_password(password, house["password_hash"]):
        return None
    return house


def create_house_token(house: dict) -> str:
    now = int(time.time())
    payload = {
        "v": TOKEN_VERSION,
        "house_id": house["id"],
        "house_name": house["name"],
        "session_version": int(house.get("session_version", 1)),
        "iat": now,
        "exp": now + HOUSE_TOKEN_TTL_SECONDS,
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_part = _urlsafe_encode(payload_json)
    signature = hmac.new(
        TOKEN_SECRET.encode("utf-8"),
        payload_part.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{payload_part}.{_urlsafe_encode(signature)}"


def parse_house_token(token: str) -> Optional[dict]:
    if not token or "." not in token:
        return None

    payload_part, signature_part = token.split(".", 1)
    expected_signature = hmac.new(
        TOKEN_SECRET.encode("utf-8"),
        payload_part.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    try:
        provided_signature = _urlsafe_decode(signature_part)
    except Exception:
        return None

    if not hmac.compare_digest(expected_signature, provided_signature):
        return None

    try:
        payload = json.loads(_urlsafe_decode(payload_part).decode("utf-8"))
    except Exception:
        return None

    if payload.get("v") != TOKEN_VERSION:
        return None

    house_id = payload.get("house_id")
    expires_at = payload.get("exp")
    session_version = payload.get("session_version")
    if not isinstance(house_id, int):
        return None
    if not isinstance(expires_at, int) or expires_at <= int(time.time()):
        return None
    if not isinstance(session_version, int):
        return None

    house = get_house_by_id(house_id)
    if not house:
        return None
    if int(house.get("session_version", 1)) != session_version:
        return None

    return {
        "id": house["id"],
        "slug": house["slug"],
        "name": house["name"],
    }


def rotate_house_session_version(house_id: int) -> int:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE houses
                SET session_version = session_version + 1
                WHERE id = %s
                RETURNING session_version
                """,
                (house_id,),
            )
            row = cur.fetchone()
        con.commit()

    if not row:
        raise ValueError("House not found")
    return row["session_version"]
