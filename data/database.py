import os
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
                    password_hash TEXT NULL
                )
                """
            )
            cur.execute(
                """
                INSERT INTO houses (slug)
                VALUES ('default')
                ON CONFLICT (slug) DO NOTHING
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
                CREATE INDEX IF NOT EXISTS laundry_bookings_house_id_idx
                ON laundry_bookings (house_id)
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

            # Dinner attendance table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS dinner_attendance (
                    date DATE NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    eats INTEGER DEFAULT 0,
                    friends INTEGER DEFAULT 0,
                    cooks INTEGER DEFAULT 0,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    PRIMARY KEY(date, user_id, house_id)
                )
                """
            )
            cur.execute(
                """
                ALTER TABLE dinner_attendance
                ADD COLUMN IF NOT EXISTS house_id INTEGER
                """
            )
            cur.execute(
                """
                UPDATE dinner_attendance
                SET house_id = %s
                WHERE house_id IS NULL
                """,
                (default_house_id,),
            )
            cur.execute(
                """
                ALTER TABLE dinner_attendance
                ALTER COLUMN house_id SET NOT NULL
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'dinner_attendance_house_id_fkey'
                    ) THEN
                        ALTER TABLE dinner_attendance
                        ADD CONSTRAINT dinner_attendance_house_id_fkey
                        FOREIGN KEY (house_id) REFERENCES houses(id);
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                ALTER TABLE dinner_attendance
                DROP CONSTRAINT IF EXISTS dinner_attendance_pkey
                """
            )
            cur.execute(
                """
                ALTER TABLE dinner_attendance
                ADD CONSTRAINT dinner_attendance_pkey
                PRIMARY KEY (date, user_id, house_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS dinner_attendance_house_id_idx
                ON dinner_attendance (house_id)
                """
            )

            # Guestroom bookings table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS guestroom_bookings (
                    id SERIAL PRIMARY KEY,
                    house_id INTEGER NOT NULL REFERENCES houses(id),
                    responsible_user_id INTEGER NOT NULL REFERENCES users(id),
                    guest_name TEXT NOT NULL,
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
