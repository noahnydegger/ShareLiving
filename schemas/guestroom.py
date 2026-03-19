from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class GuestroomBookingIn(BaseModel):
    person_id: int
    guest_room_id: Optional[int] = None
    guest_name: str
    start_at: datetime
    end_at: datetime


class GuestroomBookingOut(BaseModel):
    id: int
    person_id: int
    guest_room_id: Optional[int] = None
    responsible_name: str
    guest_name: str
    room_name: str
    start_at: datetime
    end_at: datetime
    duration_minutes: int


class GuestroomConflictOut(BaseModel):
    id: int
    responsible_name: str
    room_name: str
    start_at: datetime
    end_at: datetime


class GuestroomBookingListOut(BaseModel):
    items: list[GuestroomBookingOut]
    offset: int
    limit: int
    has_previous: bool
    has_next: bool
