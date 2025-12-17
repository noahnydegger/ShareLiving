import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / "data.db"

def get_connection():
    # returns a sqlite3 connection object
    return sqlite3.connect(db_path)

def init_db():
    # initializes the database with necessary tables
    con = get_connection()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS laundry_bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            slot TEXT NOT NULL,
            user TEXT NOT NULL
        )
    """)

    # dinner table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dinner_attendance (
            date TEXT NOT NULL,
            user_id TEXT NOT NULL,
            eats INTEGER DEFAULT 0,
            friends INTEGER DEFAULT 0,
            cooks INTEGER DEFAULT 0,
            PRIMARY KEY (date, user_id)
        )
    """)
    
    con.commit()
    con.close()



