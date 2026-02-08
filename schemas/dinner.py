from pydantic import BaseModel
from datetime import date
from typing import List


class DinnerDayIn(BaseModel):
    date: date
    eats: bool
    cooks: bool
    guests: int


class DinnerAttendanceIn(BaseModel):
    username: str
    days: List[DinnerDayIn]


class DinnerSummaryDayOut(BaseModel):
    date: date
    cooks: List[str]
    total_people: int


class DinnerSummaryOut(BaseModel):
    days: List[DinnerSummaryDayOut]
