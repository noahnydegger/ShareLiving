

from fastapi import APIRouter, Depends, HTTPException

import services.dinner_service as dinner_service
from services.user_service import get_or_create_user_id
from data.house_context import get_current_house_id
from schemas.dinner import DinnerAttendanceIn, DinnerSummaryOut

router = APIRouter(
    prefix="/api/dinner",
    tags=["dinner"],
)


@router.get("/summary", response_model=DinnerSummaryOut)
def get_dinner_summary(
    house_id: int = Depends(get_current_house_id),
):
    return {"days": dinner_service.get_week_summary(house_id)}


@router.post("/attendance")
def add_dinner_attendance(
    attendance: DinnerAttendanceIn,
    house_id: int = Depends(get_current_house_id),
):
    if not attendance.username.strip():
        raise HTTPException(status_code=400, detail="Username is required")
    dinner_service.upsert_week_attendance(
        get_or_create_user_id(attendance.username),
        house_id,
        [day.dict() for day in attendance.days],
    )
    return {"status": "ok"}
