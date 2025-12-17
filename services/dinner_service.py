from data.database import get_connection
from datetime import date, timedelta

def get_week_dates(start=None):
    """Return a list of 7 dates starting from today or given start date."""
    if start is None:
        start = date.today()
    return [(start + timedelta(days=i)).isoformat() for i in range(7)]

def get_dinner_data(user_id):
    """
    Return a dict keyed by date:
    { '2025-12-11': {'eats': True, 'friends': False, 'cooks': True, 'total_people': 2}, ... }
    """
    con = get_connection()
    cur = con.cursor()
    week_dates = get_week_dates()
    data = {}
    for d in week_dates:
        cur.execute("""
            SELECT eats, friends, cooks
            FROM dinner_attendance
            WHERE date=? AND user_id=?
        """, (d, user_id))
        row = cur.fetchone()
        eats = bool(row[0]) if row else False
        friends = bool(row[1]) if row else False
        cooks = bool(row[2]) if row else False

        # count total people
        cur.execute("""
            SELECT SUM(eats + friends) 
            FROM dinner_attendance
            WHERE date=?
        """, (d,))
        total = cur.fetchone()[0] or 0

        data[d] = {
            "eats": eats,
            "friends": friends,
            "cooks": cooks,
            "total_people": total
        }
    con.close()
    return data

def update_dinner(user_id, form_data):
    """Update dinner preferences for a week based on form input."""
    con = get_connection()
    cur = con.cursor()
    week_dates = get_week_dates()
    for d in week_dates:
        eats = 1 if form_data.get(f"eats_{d}") == "on" else 0
        friends = 1 if form_data.get(f"friends_{d}") == "on" else 0
        cooks = 1 if form_data.get(f"cooks_{d}") == "on" else 0

        # insert or update
        cur.execute("""
            INSERT INTO dinner_attendance (date, user_id, eats, friends, cooks)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, user_id) DO UPDATE SET eats=?, friends=?, cooks=?
        """, (d, user_id, eats, friends, cooks, eats, friends, cooks))
    con.commit()
    con.close()