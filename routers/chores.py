from typing import List

from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import ForeignKeyViolation, UniqueViolation

from data.house_context import get_current_house_id
from schemas.chores import ChoreAssignIn, ChoreCreateIn, ChoreOut
from services import chores_service
from services.people_service import get_person


router = APIRouter(prefix="/api/chores", tags=["chores"])


@router.get("", response_model=List[ChoreOut])
def get_chores(house_id: int = Depends(get_current_house_id)):
    return chores_service.list_chores(house_id)


@router.post("", response_model=ChoreOut)
def add_chore(
    payload: ChoreCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    try:
        return chores_service.create_chore(
            house_id=house_id,
            name=payload.name,
            location=payload.location,
            frequency=payload.frequency,
            effort=payload.effort,
            description=payload.description,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Chore already exists") from exc


@router.put("/{chore_id}", response_model=ChoreOut)
def update_chore(
    chore_id: int,
    payload: ChoreCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    try:
        chore = chores_service.update_chore(
            house_id=house_id,
            chore_id=chore_id,
            name=payload.name,
            location=payload.location,
            frequency=payload.frequency,
            effort=payload.effort,
            description=payload.description,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Chore already exists") from exc
    if chore is None:
        raise HTTPException(status_code=404, detail="Chore not found")
    return chore


@router.delete("/{chore_id}")
def delete_chore(
    chore_id: int,
    house_id: int = Depends(get_current_house_id),
):
    try:
        deleted = chores_service.delete_chore(house_id, chore_id)
    except ForeignKeyViolation as exc:
        raise HTTPException(status_code=409, detail="Chore is still in use") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Chore not found")
    return {"status": "ok"}


@router.post("/{chore_id}/assign", response_model=ChoreOut)
def assign_chore(
    chore_id: int,
    payload: ChoreAssignIn,
    house_id: int = Depends(get_current_house_id),
):
    if payload.person_id is not None and get_person(house_id, payload.person_id) is None:
        raise HTTPException(status_code=400, detail="Person does not belong to this house")

    chore = chores_service.assign_chore(house_id, chore_id, payload.person_id)
    if chore is None:
        raise HTTPException(status_code=404, detail="Chore not found")
    return chore
