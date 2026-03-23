from typing import List

from fastapi import APIRouter, Depends, HTTPException

from data.house_context import get_current_house_id
from schemas.feedback import FeedbackCreateIn, FeedbackOut, FeedbackResolveIn
from services import feedback_service
from services.people_service import get_person


router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.get("", response_model=List[FeedbackOut])
def get_feedback(house_id: int = Depends(get_current_house_id)):
    return feedback_service.list_feedback(house_id)


@router.post("", response_model=FeedbackOut)
def add_feedback(
    payload: FeedbackCreateIn,
    house_id: int = Depends(get_current_house_id),
):
    if get_person(house_id, payload.person_id) is None:
        raise HTTPException(status_code=400, detail="Person does not belong to this house")
    if payload.feedback_type not in {"bug", "idea"}:
        raise HTTPException(status_code=400, detail="Invalid feedback type")
    if payload.priority not in {"high", "medium", "low"}:
        raise HTTPException(status_code=400, detail="Invalid priority")

    try:
        return feedback_service.create_feedback_item(
            house_id=house_id,
            person_id=payload.person_id,
            area=payload.area,
            feedback_type=payload.feedback_type,
            description=payload.description,
            priority=payload.priority,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{feedback_id}/resolve", response_model=FeedbackOut)
def resolve_feedback(
    feedback_id: int,
    payload: FeedbackResolveIn,
    house_id: int = Depends(get_current_house_id),
):
    feedback_item = feedback_service.set_feedback_resolved(house_id, feedback_id, payload.resolved)
    if feedback_item is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return feedback_item
