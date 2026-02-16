from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException

import services.guestroom_service as guestroom_service
from data.house_context import get_current_house_id
from schemas.guestroom import GuestroomBookingIn, GuestroomBookingOut
from services.user_service import get_or_create_user_id

router = APIRouter(
    prefix="/api/guestroom",
    tags=["guestroom"],
)


@router.get("", response_model=List[GuestroomBookingOut])
def get_guestroom_bookings(
    house_id: int = Depends(get_current_house_id),
):
    return guestroom_service.get_bookings(house_id)


@router.post("")
def add_guestroom_booking(
    booking: GuestroomBookingIn,
    house_id: int = Depends(get_current_house_id),
):
    if not booking.responsible_name.strip():
        raise HTTPException(status_code=400, detail="Responsible name is required")
    if not booking.guest_name.strip():
        raise HTTPException(status_code=400, detail="Guest name is required")

    if booking.end_at <= booking.start_at:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time",
        )

    duration_minutes = int(
        (booking.end_at - booking.start_at).total_seconds() / 60
    )

    success = guestroom_service.add_booking(
        house_id=house_id,
        responsible_user_id=get_or_create_user_id(booking.responsible_name),
        guest_name=booking.guest_name,
        start_at=booking.start_at,
        end_at=booking.end_at,
        duration_minutes=duration_minutes,
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save booking")

    return {"status": "ok"}
