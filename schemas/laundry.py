from pydantic import BaseModel
from datetime import date, time


class LaundryBookingIn(BaseModel):
    date: date
    person_id: int
    machine: str
    start_time: time
    end_time: time


class LaundryBookingOut(BaseModel):
    id: int
    person_id: int
    date: date
    person_name: str
    machine: str
    start_time: time
    end_time: time
    duration_minutes: int


class LaundryBookingListOut(BaseModel):
    items: list[LaundryBookingOut]
    offset: int
    limit: int
    has_previous: bool
    has_next: bool
