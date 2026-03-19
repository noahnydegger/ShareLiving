from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from typing import List, Optional

import services.laundry_service as laundry_service
from services.people_service import get_person
from data.house_context import get_current_house_id
from schemas.laundry import LaundryBookingIn, LaundryBookingListOut, LaundryBookingOut

router = APIRouter(
    prefix="/api/laundry",
    tags=["laundry"],
)


@router.get("", response_model=List[LaundryBookingOut])
def get_laundry_bookings(
    person_id: Optional[int] = Query(default=None),
    house_id: int = Depends(get_current_house_id),
):
    """
    Return all laundry bookings.

    The authenticated user is injected automatically,
    but bookings are currently visible to all users.
    """
    if person_id is not None and get_person(house_id, person_id) is None:
        return []
    return laundry_service.get_bookings(house_id=house_id, person_id=person_id)


@router.get("/upcoming", response_model=LaundryBookingListOut)
def get_upcoming_laundry_bookings(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=50),
    house_id: int = Depends(get_current_house_id),
):
    return laundry_service.get_upcoming_bookings(house_id=house_id, limit=limit, offset=offset)


@router.post("")
def book_laundry_slot(
    booking: LaundryBookingIn,
    house_id: int = Depends(get_current_house_id),
):
    """
    Book a laundry slot for the authenticated user.
    """
    person = get_person(house_id, booking.person_id)
    if person is None:
        raise HTTPException(status_code=400, detail="Person does not belong to this house")

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
        booking.person_id,
        house_id,
        booking.machine,
    )
    if not success:
        raise HTTPException(
            status_code=409,
            detail="Selected machine is already booked during this time"
        )
    return {"status": "ok"}


@router.put("/{booking_id}")
def update_laundry_booking(
    booking_id: int,
    booking: LaundryBookingIn,
    house_id: int = Depends(get_current_house_id),
):
    person = get_person(house_id, booking.person_id)
    if person is None:
        raise HTTPException(status_code=400, detail="Person does not belong to this house")

    start_dt = datetime.combine(booking.date, booking.start_time)
    end_dt = datetime.combine(booking.date, booking.end_time)
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    duration_minutes = int((end_dt - start_dt).total_seconds() / 60)

    success = laundry_service.update_booking(
        booking_id,
        booking.date,
        booking.start_time,
        booking.end_time,
        duration_minutes,
        booking.person_id,
        house_id,
        booking.machine,
    )
    if not success:
        raise HTTPException(status_code=409, detail="Selected machine is already booked during this time or booking is missing")
    return {"status": "ok"}


@router.delete("/{booking_id}")
def delete_laundry_booking(
    booking_id: int,
    house_id: int = Depends(get_current_house_id),
):
    deleted = laundry_service.delete_booking(booking_id, house_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"status": "ok"}
