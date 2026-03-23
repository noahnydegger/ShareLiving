import os
from typing import Optional

import psycopg
from psycopg.rows import dict_row
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/shareliving",
)

# Sync connection string for psycopg (remove +asyncpg)
SYNC_DATABASE_URL = os.environ.get(
    "SYNC_DATABASE_URL",
    "postgresql://postgres:postgres@localhost/shareliving"
)

try:
    engine = create_async_engine(DATABASE_URL)
    async_session_maker = sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
except ModuleNotFoundError:
    engine = None
    async_session_maker = None

Base = declarative_base()


def get_connection():
    """
    Return a synchronous PostgreSQL connection with dict_row factory.
    Use as a context manager.
    """
    return psycopg.connect(SYNC_DATABASE_URL, row_factory=dict_row)


def get_default_house_id() -> int:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM houses
                WHERE slug = 'default'
                """
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("Default house is missing")
            return row["id"]


def get_house_by_id(house_id: int) -> Optional[dict]:
    with get_connection() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT id, slug, name, password_hash, session_version
                FROM houses
                WHERE id = %s
                """,
                (house_id,),
            )
            return cur.fetchone()


async def get_async_session() -> AsyncSession:
    if async_session_maker is None:
        raise RuntimeError(
            "Async database session is unavailable; install asyncpg to enable it."
        )
    async with async_session_maker() as session:
        yield session

def init_db():
    """
    Initialize database schema.

    This function is idempotent and safe to call on startup.
    """
    with get_connection() as con:
        with con.cursor() as cur:
            # Houses table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS houses (
                    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                    slug TEXT UNIQUE NOT NULL,
                    name TEXT,
                    password_hash TEXT NULL,
                    session_version INTEGER NOT NULL DEFAULT 1
                )
                """
            )
            cur.execute(
                """
                ALTER TABLE houses
                ADD COLUMN IF NOT EXISTS name TEXT
                """
            )
            cur.execute(
                """
                ALTER TABLE houses
                ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1
                """
            )
            cur.execute(
                """
                INSERT INTO houses (slug, name)
                VALUES ('default', 'default')
                ON CONFLICT (slug) DO NOTHING
                """
            )
            cur.execute(
                """
                UPDATE houses
                SET session_version = 1
                WHERE session_version IS NULL
                """
            )
            cur.execute(
                """
                UPDATE houses
                SET name = slug
                WHERE name IS NULL
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS houses_name_lower_idx
                ON houses (LOWER(name))
                """
            )
            cur.execute(
                """
                SELECT id
                FROM houses
                WHERE slug = 'default'
                """
            )
            default_house_id = cur.fetchone()["id"]

            # Living groups and people are house-managed and replace the
            # old global username flow for shared services.
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS living_groups (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    name TEXT NOT NULL
                )
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS living_groups_house_name_idx
                ON living_groups (house_id, LOWER(name))
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS people (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    name TEXT NOT NULL,
                    living_group_id INTEGER NULL REFERENCES living_groups(id)
                )
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS people_house_name_idx
                ON people (house_id, LOWER(name))
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS people_house_id_idx
                ON people (house_id)
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS guest_rooms (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    name TEXT NOT NULL
                )
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS guest_rooms_house_name_idx
                ON guest_rooms (house_id, LOWER(name))
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chores (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    name TEXT NOT NULL,
                    location TEXT NULL,
                    frequency TEXT NULL,
                    effort DOUBLE PRECISION NULL,
                    description TEXT NULL,
                    assigned_person_id INTEGER NULL REFERENCES people(id)
                )
                """
            )
            cur.execute(
                """
                ALTER TABLE chores
                ADD COLUMN IF NOT EXISTS location TEXT NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE chores
                ADD COLUMN IF NOT EXISTS frequency TEXT NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE chores
                ADD COLUMN IF NOT EXISTS effort DOUBLE PRECISION NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE chores
                ADD COLUMN IF NOT EXISTS description TEXT NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE chores
                ADD COLUMN IF NOT EXISTS assigned_person_id INTEGER NULL
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'chores_assigned_person_id_fkey'
                    ) THEN
                        ALTER TABLE chores
                        ADD CONSTRAINT chores_assigned_person_id_fkey
                        FOREIGN KEY (assigned_person_id) REFERENCES people(id);
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS chores_house_name_idx
                ON chores (house_id, LOWER(name))
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS chores_house_id_idx
                ON chores (house_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS chores_assigned_person_id_idx
                ON chores (assigned_person_id)
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS defects (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    person_id INTEGER NOT NULL REFERENCES people(id),
                    room TEXT NOT NULL,
                    room_location TEXT NOT NULL,
                    description TEXT NOT NULL,
                    damage_source TEXT NOT NULL,
                    resolution_type TEXT NOT NULL,
                    photo_available BOOLEAN NOT NULL DEFAULT FALSE,
                    photo_link TEXT NULL,
                    reported_date DATE NOT NULL,
                    officially_resolved BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                ALTER TABLE defects
                ADD COLUMN IF NOT EXISTS photo_link TEXT NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE defects
                ADD COLUMN IF NOT EXISTS officially_resolved BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
            cur.execute(
                """
                ALTER TABLE defects
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
                """
            )
            cur.execute(
                """
                ALTER TABLE defects
                DROP CONSTRAINT IF EXISTS defects_damage_source_check
                """
            )
            cur.execute(
                """
                ALTER TABLE defects
                ADD CONSTRAINT defects_damage_source_check
                CHECK (damage_source IN ('existing', 'self_caused'))
                """
            )
            cur.execute(
                """
                ALTER TABLE defects
                DROP CONSTRAINT IF EXISTS defects_resolution_type_check
                """
            )
            cur.execute(
                """
                ALTER TABLE defects
                ADD CONSTRAINT defects_resolution_type_check
                CHECK (resolution_type IN ('must_fix', 'must_record'))
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS defects_house_id_idx
                ON defects (house_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS defects_person_id_idx
                ON defects (person_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS defects_reported_date_idx
                ON defects (reported_date)
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS feedback (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    person_id INTEGER NOT NULL REFERENCES people(id),
                    area TEXT NOT NULL,
                    feedback_type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    priority TEXT NOT NULL DEFAULT 'medium',
                    resolved BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                ALTER TABLE feedback
                ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
                """
            )
            cur.execute(
                """
                ALTER TABLE feedback
                ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
            cur.execute(
                """
                ALTER TABLE feedback
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
                """
            )
            cur.execute(
                """
                ALTER TABLE feedback
                DROP CONSTRAINT IF EXISTS feedback_feedback_type_check
                """
            )
            cur.execute(
                """
                ALTER TABLE feedback
                ADD CONSTRAINT feedback_feedback_type_check
                CHECK (feedback_type IN ('bug', 'idea'))
                """
            )
            cur.execute(
                """
                ALTER TABLE feedback
                DROP CONSTRAINT IF EXISTS feedback_priority_check
                """
            )
            cur.execute(
                """
                ALTER TABLE feedback
                ADD CONSTRAINT feedback_priority_check
                CHECK (priority IN ('high', 'medium', 'low'))
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS feedback_house_id_idx
                ON feedback (house_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS feedback_person_id_idx
                ON feedback (person_id)
                """
            )

            # Users table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
                    is_verified BOOLEAN NOT NULL DEFAULT FALSE
                )

                """
            )

            # Laundry bookings table with foreign key
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS laundry_bookings (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL,
                    slot TEXT NOT NULL,
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    duration_minutes INTEGER NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    UNIQUE(date, slot)
                )
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ADD COLUMN IF NOT EXISTS person_id INTEGER
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ADD COLUMN IF NOT EXISTS machine TEXT NOT NULL DEFAULT 'links'
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ALTER COLUMN user_id DROP NOT NULL
                """
            )

            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL DEFAULT '00:00'
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ADD COLUMN IF NOT EXISTS end_time TIME NOT NULL DEFAULT '00:00'
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 0
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ADD COLUMN IF NOT EXISTS house_id INTEGER
                """
            )
            cur.execute(
                """
                UPDATE laundry_bookings
                SET house_id = %s
                WHERE house_id IS NULL
                """,
                (default_house_id,),
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ALTER COLUMN house_id SET NOT NULL
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'laundry_bookings_house_id_fkey'
                    ) THEN
                        ALTER TABLE laundry_bookings
                        ADD CONSTRAINT laundry_bookings_house_id_fkey
                        FOREIGN KEY (house_id) REFERENCES houses(id);
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                DROP CONSTRAINT IF EXISTS laundry_bookings_machine_check
                """
            )
            cur.execute(
                """
                UPDATE laundry_bookings
                SET machine = CASE machine
                    WHEN '1' THEN 'links'
                    WHEN '2' THEN 'rechts'
                    WHEN '1 und 2' THEN 'beide'
                    ELSE machine
                END
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                ADD CONSTRAINT laundry_bookings_machine_check
                CHECK (machine IN ('links', 'rechts', 'beide'))
                """
            )

            # Food planning stores one row per person/date/meal inside a house.
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS food_entries (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    person_id INTEGER NOT NULL REFERENCES people(id),
                    date DATE NOT NULL,
                    meal_type TEXT NOT NULL,
                    eats BOOLEAN NOT NULL DEFAULT FALSE,
                    cooks BOOLEAN NOT NULL DEFAULT FALSE,
                    cook_helper BOOLEAN NOT NULL DEFAULT FALSE,
                    guests INTEGER NOT NULL DEFAULT 0,
                    take_leftovers_next_day BOOLEAN NOT NULL DEFAULT FALSE,
                    eating_time TIME NOT NULL,
                    cooking_group_id INTEGER NULL REFERENCES living_groups(id),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    notes TEXT NULL
                )
                """
            )
            cur.execute(
                """
                ALTER TABLE food_entries
                ADD COLUMN IF NOT EXISTS cook_helper BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
            cur.execute(
                """
                ALTER TABLE food_entries
                ADD COLUMN IF NOT EXISTS take_leftovers_next_day BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
            cur.execute(
                """
                ALTER TABLE food_entries
                ADD COLUMN IF NOT EXISTS cooking_group_id INTEGER NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE food_entries
                ADD COLUMN IF NOT EXISTS cooking_group_name TEXT NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE food_entries
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                """
            )
            cur.execute(
                """
                ALTER TABLE food_entries
                ADD COLUMN IF NOT EXISTS notes TEXT NULL
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'food_entries_cooking_group_id_fkey'
                    ) THEN
                        ALTER TABLE food_entries
                        ADD CONSTRAINT food_entries_cooking_group_id_fkey
                        FOREIGN KEY (cooking_group_id) REFERENCES living_groups(id);
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                ALTER TABLE food_entries
                DROP CONSTRAINT IF EXISTS food_entries_meal_type_check
                """
            )
            cur.execute(
                """
                ALTER TABLE food_entries
                ADD CONSTRAINT food_entries_meal_type_check
                CHECK (meal_type IN ('lunch', 'dinner', 'brunch'))
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS food_entries_house_person_date_meal_idx
                ON food_entries (house_id, person_id, date, meal_type)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS food_entries_house_date_idx
                ON food_entries (house_id, date)
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'laundry_bookings_person_id_fkey'
                    ) THEN
                        ALTER TABLE laundry_bookings
                        ADD CONSTRAINT laundry_bookings_person_id_fkey
                        FOREIGN KEY (person_id) REFERENCES people(id);
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS laundry_bookings_house_id_idx
                ON laundry_bookings (house_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS laundry_bookings_person_id_idx
                ON laundry_bookings (person_id)
                """
            )
            cur.execute(
                """
                ALTER TABLE laundry_bookings
                DROP CONSTRAINT IF EXISTS laundry_bookings_date_slot_key
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'laundry_bookings_house_date_slot_key'
                    ) THEN
                        ALTER TABLE laundry_bookings
                        ADD CONSTRAINT laundry_bookings_house_date_slot_key
                        UNIQUE (house_id, date, slot);
                    END IF;
                END
                $$;
                """
            )

            # Guestroom bookings table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS guestroom_bookings (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    responsible_user_id INTEGER NULL REFERENCES users(id),
                    person_id INTEGER NOT NULL REFERENCES people(id),
                    guest_room_id INTEGER NULL REFERENCES guest_rooms(id),
                    guest_name TEXT NOT NULL,
                    room_name TEXT NOT NULL DEFAULT 'Eigenes Zimmer',
                    start_at TIMESTAMP NOT NULL,
                    end_at TIMESTAMP NOT NULL,
                    duration_minutes INTEGER NOT NULL
                )
                """
            )
            cur.execute(
                """
                ALTER TABLE guestroom_bookings
                ADD COLUMN IF NOT EXISTS house_id INTEGER
                """
            )
            cur.execute(
                """
                ALTER TABLE guestroom_bookings
                ADD COLUMN IF NOT EXISTS person_id INTEGER
                """
            )
            cur.execute(
                """
                ALTER TABLE guestroom_bookings
                ADD COLUMN IF NOT EXISTS guest_room_id INTEGER
                """
            )
            cur.execute(
                """
                ALTER TABLE guestroom_bookings
                ADD COLUMN IF NOT EXISTS room_name TEXT NOT NULL DEFAULT 'Eigenes Zimmer'
                """
            )
            cur.execute(
                """
                UPDATE guestroom_bookings
                SET house_id = %s
                WHERE house_id IS NULL
                """,
                (default_house_id,),
            )
            cur.execute(
                """
                ALTER TABLE guestroom_bookings
                ALTER COLUMN house_id SET NOT NULL
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'guestroom_bookings_house_id_fkey'
                    ) THEN
                        ALTER TABLE guestroom_bookings
                        ADD CONSTRAINT guestroom_bookings_house_id_fkey
                        FOREIGN KEY (house_id) REFERENCES houses(id);
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS guestroom_bookings_house_id_idx
                ON guestroom_bookings (house_id)
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'guestroom_bookings_person_id_fkey'
                    ) THEN
                        ALTER TABLE guestroom_bookings
                        ADD CONSTRAINT guestroom_bookings_person_id_fkey
                        FOREIGN KEY (person_id) REFERENCES people(id);
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS guestroom_bookings_person_id_idx
                ON guestroom_bookings (person_id)
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'guestroom_bookings_guest_room_id_fkey'
                    ) THEN
                        ALTER TABLE guestroom_bookings
                        ADD CONSTRAINT guestroom_bookings_guest_room_id_fkey
                        FOREIGN KEY (guest_room_id) REFERENCES guest_rooms(id);
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS guestroom_bookings_guest_room_id_idx
                ON guestroom_bookings (guest_room_id)
                """
            )
            cur.execute(
                """
                INSERT INTO people (house_id, name)
                SELECT DISTINCT source.house_id, source.username
                FROM (
                    SELECT lb.house_id, u.username
                    FROM laundry_bookings lb
                    JOIN users u ON lb.user_id = u.id
                    UNION
                    SELECT gb.house_id, u.username
                    FROM guestroom_bookings gb
                    JOIN users u ON gb.responsible_user_id = u.id
                ) AS source
                WHERE source.username IS NOT NULL
                ON CONFLICT DO NOTHING
                """
            )
            cur.execute(
                """
                UPDATE laundry_bookings AS lb
                SET person_id = p.id
                FROM users AS u, people AS p
                WHERE lb.user_id = u.id
                  AND p.house_id = lb.house_id
                  AND LOWER(p.name) = LOWER(u.username)
                  AND lb.person_id IS NULL
                """
            )
            cur.execute(
                """
                UPDATE guestroom_bookings AS gb
                SET person_id = p.id
                FROM users AS u, people AS p
                WHERE gb.responsible_user_id = u.id
                  AND p.house_id = gb.house_id
                  AND LOWER(p.name) = LOWER(u.username)
                  AND gb.person_id IS NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE guestroom_bookings
                ALTER COLUMN person_id SET NOT NULL
                """
            )
            cur.execute(
                """
                ALTER TABLE guestroom_bookings
                ALTER COLUMN responsible_user_id DROP NOT NULL
                """
            )
