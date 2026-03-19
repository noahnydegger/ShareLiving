from typing import List

from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import ForeignKeyViolation, UniqueViolation

from data.house_context import get_current_house_id
from schemas.people import (
    GuestRoomCreateIn,
    GuestRoomOut,
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


@router.get("/guest-rooms", response_model=List[GuestRoomOut])
def get_guest_rooms(house_id: int = Depends(get_current_house_id)):
    return people_service.list_guest_rooms(house_id)


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


@router.put("/living-groups/{living_group_id}", response_model=LivingGroupOut)
def update_living_group(
    living_group_id: int,
    payload: LivingGroupCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    try:
        living_group = people_service.update_living_group(house_id, living_group_id, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Living group already exists") from exc
    if living_group is None:
        raise HTTPException(status_code=404, detail="Living group not found")
    return living_group


@router.delete("/living-groups/{living_group_id}")
def delete_living_group(
    living_group_id: int,
    house_id: int = Depends(get_current_house_id),
):
    try:
        deleted = people_service.delete_living_group(house_id, living_group_id)
    except ForeignKeyViolation as exc:
        raise HTTPException(status_code=409, detail="Living group is still in use") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Living group not found")
    return {"status": "ok"}


@router.post("/guest-rooms", response_model=GuestRoomOut)
def add_guest_room(
    payload: GuestRoomCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    try:
        return people_service.create_guest_room(house_id, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Guest room already exists") from exc


@router.put("/guest-rooms/{guest_room_id}", response_model=GuestRoomOut)
def update_guest_room(
    guest_room_id: int,
    payload: GuestRoomCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    try:
        guest_room = people_service.update_guest_room(house_id, guest_room_id, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Guest room already exists") from exc
    if guest_room is None:
        raise HTTPException(status_code=404, detail="Guest room not found")
    return guest_room


@router.delete("/guest-rooms/{guest_room_id}")
def delete_guest_room(
    guest_room_id: int,
    house_id: int = Depends(get_current_house_id),
):
    try:
        deleted = people_service.delete_guest_room(house_id, guest_room_id)
    except ForeignKeyViolation as exc:
        raise HTTPException(status_code=409, detail="Guest room is still in use") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Guest room not found")
    return {"status": "ok"}


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


@router.put("/people/{person_id}", response_model=PersonOut)
def update_person(
    person_id: int,
    payload: PersonCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    try:
        person = people_service.update_person(house_id, person_id, payload.name, payload.living_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Person already exists") from exc
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@router.delete("/people/{person_id}")
def delete_person(
    person_id: int,
    house_id: int = Depends(get_current_house_id),
):
    try:
        deleted = people_service.delete_person(house_id, person_id)
    except ForeignKeyViolation as exc:
        raise HTTPException(status_code=409, detail="Person is still in use") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Person not found")
    return {"status": "ok"}
