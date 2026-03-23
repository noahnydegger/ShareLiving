from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class DefectCreateIn(BaseModel):
    person_id: int
    room: str
    room_location: str
    description: str
    damage_source: str
    resolution_type: str
    photo_available: bool = False
    photo_link: Optional[str] = None
    reported_date: date


class DefectResolveIn(BaseModel):
    officially_resolved: bool


class DefectOut(BaseModel):
    id: int
    house_id: int
    person_id: int
    person_name: str
    room: str
    room_location: str
    description: str
    damage_source: str
    resolution_type: str
    photo_available: bool
    photo_link: Optional[str] = None
    reported_date: date
    officially_resolved: bool
    created_at: datetime
