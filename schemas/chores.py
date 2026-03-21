from typing import Optional

from pydantic import BaseModel


class ChoreCreateIn(BaseModel):
    name: str
    location: Optional[str] = None
    frequency: Optional[str] = None
    effort: Optional[float] = None
    description: Optional[str] = None


class ChoreAssignIn(BaseModel):
    person_id: Optional[int] = None


class ChoreOut(BaseModel):
    id: int
    house_id: int
    name: str
    location: Optional[str] = None
    frequency: Optional[str] = None
    effort: Optional[float] = None
    description: Optional[str] = None
    assigned_person_id: Optional[int] = None
    assigned_person_name: Optional[str] = None
