from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import List, Optional

import services.laundry_service as laundry_service
from services.user_service import get_or_create_user_id, get_user_id
from schemas.laundry import LaundryBookingIn, LaundryBookingOut

router = APIRouter(
    prefix="/api/laundry",
    tags=["laundry"],
)


@router.get("", response_model=List[LaundryBookingOut])
def get_laundry_bookings(
    username: Optional[str] = Query(default=None),
):
    """
    Return all laundry bookings.

    The authenticated user is injected automatically,
    but bookings are currently visible to all users.
    """
    user_id = None
    if username:
        user_id = get_user_id(username)
        if user_id is None:
            return []
    return laundry_service.get_bookings(user_id=user_id)


@router.post("")
def book_laundry_slot(
    booking: LaundryBookingIn,
):
    """
    Book a laundry slot for the authenticated user.
    """
    if not booking.username.strip():
        raise HTTPException(status_code=400, detail="Username is required")

    start_dt = datetime.combine(booking.date, booking.start_time)
    end_dt = datetime.combine(booking.date, booking.end_time)
    if end_dt <= start_dt:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time",
        )
    duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

    success = laundry_service.book_slot(
        booking.date,
        booking.start_time,
        booking.end_time,
        duration_minutes,
        get_or_create_user_id(booking.username),
    )
    if not success:
        raise HTTPException(
            status_code=409,
            detail="Slot already booked"
        )
    return {"status": "ok"}
