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

            # Dinner attendance table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS dinner_attendance (
                    date DATE NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    eats INTEGER DEFAULT 0,
                    friends INTEGER DEFAULT 0,
                    cooks INTEGER DEFAULT 0,
                    PRIMARY KEY(date, user_id)
                )
                """
            )
