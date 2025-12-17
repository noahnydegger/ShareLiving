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
