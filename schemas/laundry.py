from pydantic import BaseModel
from datetime import date, time

class LaundryBookingIn(BaseModel):
    date: date
    username: str
    start_time: time
    end_time: time

class LaundryBookingOut(BaseModel):
    id: int
    date: date
    user: str
    start_time: time
    end_time: time
    duration_minutes: int
