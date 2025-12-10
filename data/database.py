import sqlite3

def get_connection():
    return sqlite3.connect("data.db")

con = sqlite3.connect("data.db")
cur = con.cursor()
cur.execute("""
    create table if not exists laundry_bookings (
        id integer primary key,
        date text,
        slot text,
        user text
    )
""")
con.commit()
con.close()

