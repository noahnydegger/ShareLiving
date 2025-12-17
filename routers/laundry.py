from fastapi import APIRouter, Depends, HTTPException
from typing import List

import services.laundry_service as laundry_service
from schemas.laundry import LaundryBookingIn, LaundryBookingOut
from auth import fastapi_users

router = APIRouter(
    prefix="/api/laundry",
    tags=["laundry"],
)


@router.get("", response_model=List[LaundryBookingOut])
def get_laundry_bookings(
    user=Depends(fastapi_users.current_user())
):
    """
    Return all laundry bookings.

    The authenticated user is injected automatically,
    but bookings are currently visible to all users.
    """
    return laundry_service.get_bookings()


@router.post("")
def book_laundry_slot(
    booking: LaundryBookingIn,
    user=Depends(fastapi_users.current_user()),
):
    """
    Book a laundry slot for the authenticated user.
    """
    success = laundry_service.book_slot(
        booking.date,
        booking.slot,
        user.id,
    )
    if not success:
        raise HTTPException(
            status_code=409,
            detail="Slot already booked"
        )
    return {"status": "ok"}
