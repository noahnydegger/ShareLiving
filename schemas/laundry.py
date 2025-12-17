from pydantic import BaseModel
from datetime import date

class LaundryBookingIn(BaseModel):
    date: date
    slot: str

class LaundryBookingOut(BaseModel):
    id: int
    date: date
    slot: str
    user: str