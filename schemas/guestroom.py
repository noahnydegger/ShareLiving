from pydantic import BaseModel
from datetime import datetime


class GuestroomBookingIn(BaseModel):
    responsible_name: str
    guest_name: str
    start_at: datetime
    end_at: datetime


class GuestroomBookingOut(BaseModel):
    id: int
    responsible_name: str
    guest_name: str
    start_at: datetime
    end_at: datetime
    duration_minutes: int
