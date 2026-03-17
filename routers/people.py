from typing import List

from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import UniqueViolation

from data.house_context import get_current_house_id
from schemas.people import (
    LivingGroupCreateIn,
    LivingGroupOut,
    PersonCreateIn,
    PersonOut,
)
from services import people_service


router = APIRouter(prefix="/api", tags=["people"])


@router.get("/living-groups", response_model=List[LivingGroupOut])
def get_living_groups(house_id: int = Depends(get_current_house_id)):
    return people_service.list_living_groups(house_id)


@router.post("/living-groups", response_model=LivingGroupOut)
def add_living_group(
    payload: LivingGroupCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    try:
        return people_service.create_living_group(house_id, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Living group already exists") from exc


@router.get("/people", response_model=List[PersonOut])
def get_people(house_id: int = Depends(get_current_house_id)):
    return people_service.list_people(house_id)


@router.post("/people", response_model=PersonOut)
def add_person(
    payload: PersonCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    try:
        return people_service.create_person(house_id, payload.name, payload.living_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Person already exists") from exc
