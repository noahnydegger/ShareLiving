from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from data.house_context import get_current_house_id
from schemas.food import FoodEntryCreate, FoodEntryResponse, FoodSummaryResponse
from services import food_service


router = APIRouter(prefix="/api/food", tags=["food"])


@router.get("", response_model=list[FoodEntryResponse])
def get_food_entries(
    start_date: date = Query(...),
    end_date: date = Query(...),
    house_id: int = Depends(get_current_house_id),
):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    return food_service.get_food_entries_by_date_range(house_id, start_date, end_date)


@router.get("/summary", response_model=FoodSummaryResponse)
def get_food_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    house_id: int = Depends(get_current_house_id),
):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    return {"items": food_service.get_food_summary(house_id, start_date, end_date)}


@router.post("", response_model=FoodEntryResponse)
def save_food_entry(
    payload: FoodEntryCreate,
    house_id: int = Depends(get_current_house_id),
):
    try:
        return food_service.create_or_update_food_entry(
            house_id=house_id,
            person_id=payload.person_id,
            entry_date=payload.date,
            meal_type=payload.meal_type,
            eats=payload.eats,
            cooks=payload.cooks,
            cook_helper=payload.cook_helper,
            guests=payload.guests,
            take_leftovers_next_day=payload.take_leftovers_next_day,
            eating_time=payload.eating_time,
            cooking_group_name=payload.cooking_group_name,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
