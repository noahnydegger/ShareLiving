import os
from typing import AsyncGenerator
import psycopg
from psycopg.rows import dict_row
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Sync connection string for psycopg (remove +asyncpg)
SYNC_DATABASE_URL = os.environ.get(
    "SYNC_DATABASE_URL",
    "postgresql://postgres:postgres@localhost/shareliving"
)

engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

def get_connection():
    """
    Return a synchronous PostgreSQL connection with dict_row factory.
    Use as a context manager.
    """
    return psycopg.connect(SYNC_DATABASE_URL, row_factory=dict_row)

async def get_async_session() -> AsyncSession:
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
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    is_superuser BOOLEAN DEFAULT FALSE
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
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    UNIQUE(date, slot)
                )
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
