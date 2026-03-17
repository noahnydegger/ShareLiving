from datetime import date, time
from typing import List, Optional

from pydantic import BaseModel


class FoodEntryCreate(BaseModel):
    person_id: int
    date: date
    meal_type: str
    eats: bool
    cooks: bool
    cook_helper: bool
    guests: int = 0
    take_leftovers_next_day: bool = False
    eating_time: Optional[time] = None
    cooking_group_id: Optional[int] = None
    notes: Optional[str] = None


class FoodEntryResponse(BaseModel):
    id: int
    house_id: int
    person_id: int
    person_name: str
    date: date
    meal_type: str
    eats: bool
    cooks: bool
    cook_helper: bool
    guests: int
    take_leftovers_next_day: bool
    eating_time: time
    cooking_group_id: Optional[int] = None
    cooking_group_name: Optional[str] = None
    notes: Optional[str] = None


class FoodSummaryItem(BaseModel):
    date: date
    meal_type: str
    total_eaters: int
    cooks: List[str]


class FoodSummaryResponse(BaseModel):
    items: List[FoodSummaryItem]
