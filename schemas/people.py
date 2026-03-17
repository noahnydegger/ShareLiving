from typing import Optional

from pydantic import BaseModel


class LivingGroupCreateIn(BaseModel):
    name: str


class LivingGroupOut(BaseModel):
    id: int
    house_id: int
    name: str


class PersonCreateIn(BaseModel):
    name: str
    living_group_id: Optional[int] = None


class PersonOut(BaseModel):
    id: int
    house_id: int
    name: str
    living_group_id: Optional[int] = None
    living_group_name: Optional[str] = None
