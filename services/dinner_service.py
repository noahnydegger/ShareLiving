from typing import List, Dict
from datetime import date
from data.database import get_connection


def get_week_dates(start: date = None) -> List[date]:
    """Return a list of 7 consecutive dates starting from today or start."""
    from datetime import timedelta
    if start is None:
        start = date.today()
    return [start + timedelta(days=i) for i in range(7)]


def upsert_week_attendance(user_id: int, house_id: int, days: List[Dict]):
    week_dates = set(get_week_dates())
    with get_connection() as con:
        with con.cursor() as cur:
            for day in days:
                d = day["date"]
                if d not in week_dates:
                    continue
                eats = 1 if day.get("eats") else 0
                cooks = 1 if day.get("cooks") else 0
                guests = max(int(day.get("guests") or 0), 0)
                if not eats:
                    guests = 0
                    cooks = 0

                # Upsert using PostgreSQL ON CONFLICT
                cur.execute(
                    """
                    INSERT INTO dinner_attendance (
                        date, user_id, eats, friends, cooks, house_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date, user_id, house_id)
                    DO UPDATE SET eats = EXCLUDED.eats,
                                  friends = EXCLUDED.friends,
                                  cooks = EXCLUDED.cooks
                    """,
                    (d, user_id, eats, guests, cooks, house_id),
                )
        con.commit()


def get_week_summary(house_id: int) -> List[Dict]:
    week_dates = get_week_dates()
    summary: List[Dict] = []

    with get_connection() as con:
        with con.cursor() as cur:
            for d in week_dates:
                cur.execute(
                    """
                    SELECT COALESCE(SUM(eats + friends), 0) AS total
                    FROM dinner_attendance
                    WHERE date = %s AND house_id = %s
                    """,
                    (d, house_id),
                )
                total = cur.fetchone()["total"]

                cur.execute(
                    """
                    SELECT u.username
                    FROM dinner_attendance da
                    JOIN users u ON da.user_id = u.id
                    WHERE da.date = %s AND da.cooks = 1 AND da.house_id = %s
                    ORDER BY u.username
                    """,
                    (d, house_id),
                )
                cooks = [row["username"] for row in cur.fetchall()]

                summary.append(
                    {
                        "date": d,
                        "cooks": cooks,
                        "total_people": total,
                    }
                )

    return summary
