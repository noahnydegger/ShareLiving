from typing import List

from fastapi import APIRouter, Depends, HTTPException

from data.house_context import get_current_house_id
from schemas.defects import DefectCreateIn, DefectOut, DefectResolveIn
from services import defects_service
from services.people_service import get_person


router = APIRouter(prefix="/api/defects", tags=["defects"])


@router.get("", response_model=List[DefectOut])
def get_defects(house_id: int = Depends(get_current_house_id)):
    return defects_service.list_defects(house_id)


@router.post("", response_model=DefectOut)
def add_defect(
    payload: DefectCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    if get_person(house_id, payload.person_id) is None:
        raise HTTPException(status_code=400, detail="Person does not belong to this house")
    if payload.damage_source not in {"existing", "self_caused"}:
        raise HTTPException(status_code=400, detail="Invalid damage source")
    if payload.resolution_type not in {"must_fix", "must_record"}:
        raise HTTPException(status_code=400, detail="Invalid resolution type")

    try:
        return defects_service.create_defect(
            house_id=house_id,
            person_id=payload.person_id,
            room=payload.room,
            room_location=payload.room_location,
            description=payload.description,
            damage_source=payload.damage_source,
            resolution_type=payload.resolution_type,
            photo_available=payload.photo_available,
            photo_link=payload.photo_link,
            reported_date=payload.reported_date,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{defect_id}/resolve", response_model=DefectOut)
def resolve_defect(
    defect_id: int,
    payload: DefectResolveIn,
    house_id: int = Depends(get_current_house_id),
):
    defect = defects_service.set_defect_resolved(house_id, defect_id, payload.officially_resolved)
    if defect is None:
        raise HTTPException(status_code=404, detail="Defect not found")
    return defect
