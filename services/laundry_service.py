from database import get_connection

def get_bookings():
    """
    Return a list of bookings ordered by date then slot.
    Each booking is a tuple (id, date, slot, user).
    """
    con = get_connection()
    cur = con.cursor()
    cur.execute("SELECT id, date, slot, user FROM laundry_bookings ORDER BY date, slot")
    rows = cur.fetchall()
    con.close()
    return rows

def is_slot_available(date, slot):
    """
    Returns True if no booking exists for the given date and slot.
    """
    con = get_connection()
    cur = con.cursor()
    cur.execute("SELECT COUNT(1) FROM laundry_bookings WHERE date = ? AND slot = ?", (date, slot))
    count = cur.fetchone()[0]
    con.close()
    return count == 0

def book_slot(date, slot, user):
    """
    Creates a booking if the slot is available.
    Returns True if booking succeeded, False if conflict.
    """
    if not is_slot_available(date, slot):
        return False
    con = get_connection()
    cur = con.cursor()
    cur.execute(
        "INSERT INTO laundry_bookings (date, slot, user) VALUES (?, ?, ?)",
        (date, slot, user)
    )
    con.commit()
    con.close()
    return True