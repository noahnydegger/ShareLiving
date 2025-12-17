from typing import List, Dict
from datetime import date
from data.database import get_connection


def get_week_dates(start: date = None) -> List[date]:
    """Return a list of 7 consecutive dates starting from today or start."""
    from datetime import timedelta
    if start is None:
        start = date.today()
    return [start + timedelta(days=i) for i in range(7)]


def get_dinner_data(user_id: int) -> Dict[str, Dict]:
    """
    Return a dictionary keyed by date with:
    {
        '2025-12-17': {'eats': True, 'friends': False, 'cooks': False, 'total_people': 2},
        ...
    }
    """
    week_dates = get_week_dates()
    data: Dict[str, Dict] = {}

    with get_connection() as con:
        with con.cursor() as cur:
            for d in week_dates:
                cur.execute(
                    """
                    SELECT eats, friends, cooks
                    FROM dinner_attendance
                    WHERE date = %s AND user_id = %s
                    """,
                    (d, user_id),
                )
                row = cur.fetchone()
                eats = bool(row["eats"]) if row else False
                friends = bool(row["friends"]) if row else False
                cooks = bool(row["cooks"]) if row else False

                # Total attendees including friends, join with users table if needed
                cur.execute(
                    """
                    SELECT COALESCE(SUM(eats + friends),0) AS total
                    FROM dinner_attendance
                    """
                )
                total = cur.fetchone()["total"]

                data[d.isoformat()] = {
                    "eats": eats,
                    "friends": friends,
                    "cooks": cooks,
                    "total_people": total,
                }
    return data


def update_dinner(user_id: int, form_data: Dict):
    """
    Update dinner preferences for a week for a given user_id.

    form_data keys: eats_<date>, friends_<date>, cooks_<date>
    """
    week_dates = get_week_dates()
    with get_connection() as con:
        with con.cursor() as cur:
            for d in week_dates:
                eats = 1 if form_data.get(f"eats_{d}") == "on" else 0
                friends = 1 if form_data.get(f"friends_{d}") == "on" else 0
                cooks = 1 if form_data.get(f"cooks_{d}") == "on" else 0

                # Upsert using PostgreSQL ON CONFLICT
                cur.execute(
                    """
                    INSERT INTO dinner_attendance (date, user_id, eats, friends, cooks)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (date, user_id)
                    DO UPDATE SET eats = EXCLUDED.eats,
                                  friends = EXCLUDED.friends,
                                  cooks = EXCLUDED.cooks
                    """,
                    (d, user_id, eats, friends, cooks),
                )
        con.commit()