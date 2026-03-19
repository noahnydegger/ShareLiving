from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import services.guestroom_service as guestroom_service
from data.house_context import get_current_house_id
from schemas.guestroom import (
    GuestroomBookingIn,
    GuestroomBookingListOut,
    GuestroomBookingOut,
    GuestroomConflictOut,
)
from services.people_service import get_person, list_guest_rooms

router = APIRouter(
    prefix="/api/guestroom",
    tags=["guestroom"],
)


@router.get("", response_model=List[GuestroomBookingOut])
def get_guestroom_bookings(
    house_id: int = Depends(get_current_house_id),
):
    return guestroom_service.get_bookings(house_id)


@router.get("/upcoming", response_model=GuestroomBookingListOut)
def get_upcoming_guestroom_bookings(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=50),
    house_id: int = Depends(get_current_house_id),
):
    return guestroom_service.get_upcoming_bookings(house_id, limit=limit, offset=offset)


@router.get("/conflicts", response_model=List[GuestroomConflictOut])
def get_guestroom_conflicts(
    person_id: int = Query(...),
    guest_room_id: Optional[int] = Query(default=None),
    start_at: str = Query(...),
    end_at: str = Query(...),
    exclude_booking_id: Optional[int] = Query(default=None),
    house_id: int = Depends(get_current_house_id),
):
    person = get_person(house_id, person_id)
    if person is None:
        raise HTTPException(status_code=400, detail="Person does not belong to this house")

    guest_rooms = {room["id"] for room in list_guest_rooms(house_id)}
    if guest_room_id is not None and guest_room_id not in guest_rooms:
        raise HTTPException(status_code=400, detail="Guest room does not belong to this house")

    preview = GuestroomBookingIn(
        person_id=person_id,
        guest_room_id=guest_room_id,
        guest_name="preview",
        start_at=start_at,
        end_at=end_at,
    )
    return guestroom_service.get_room_conflicts(
        house_id=house_id,
        person_id=person_id,
        guest_room_id=guest_room_id,
        start_at=preview.start_at,
        end_at=preview.end_at,
        exclude_booking_id=exclude_booking_id,
    )


@router.post("")
def add_guestroom_booking(
    booking: GuestroomBookingIn,
    house_id: int = Depends(get_current_house_id),
):
    if not booking.guest_name.strip():
        raise HTTPException(status_code=400, detail="Guest name is required")

    person = get_person(house_id, booking.person_id)
    if person is None:
        raise HTTPException(status_code=400, detail="Person does not belong to this house")
    guest_rooms = {room["id"]: room for room in list_guest_rooms(house_id)}
    if booking.guest_room_id is not None and booking.guest_room_id not in guest_rooms:
        raise HTTPException(status_code=400, detail="Guest room does not belong to this house")

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
        person_id=booking.person_id,
        guest_room_id=booking.guest_room_id,
        guest_name=booking.guest_name,
        room_name=guest_rooms[booking.guest_room_id]["name"] if booking.guest_room_id is not None else "Eigenes Zimmer",
        start_at=booking.start_at,
        end_at=booking.end_at,
        duration_minutes=duration_minutes,
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save booking")

    return {"status": "ok"}


@router.put("/{booking_id}")
def update_guestroom_booking(
    booking_id: int,
    booking: GuestroomBookingIn,
    house_id: int = Depends(get_current_house_id),
):
    if not booking.guest_name.strip():
        raise HTTPException(status_code=400, detail="Guest name is required")

    person = get_person(house_id, booking.person_id)
    if person is None:
        raise HTTPException(status_code=400, detail="Person does not belong to this house")
    guest_rooms = {room["id"]: room for room in list_guest_rooms(house_id)}
    if booking.guest_room_id is not None and booking.guest_room_id not in guest_rooms:
        raise HTTPException(status_code=400, detail="Guest room does not belong to this house")

    if booking.end_at <= booking.start_at:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    duration_minutes = int((booking.end_at - booking.start_at).total_seconds() / 60)
    success = guestroom_service.update_booking(
        booking_id=booking_id,
        house_id=house_id,
        person_id=booking.person_id,
        guest_room_id=booking.guest_room_id,
        guest_name=booking.guest_name,
        room_name=guest_rooms[booking.guest_room_id]["name"] if booking.guest_room_id is not None else "Eigenes Zimmer",
        start_at=booking.start_at,
        end_at=booking.end_at,
        duration_minutes=duration_minutes,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Booking not found or could not be updated")
    return {"status": "ok"}


@router.delete("/{booking_id}")
def delete_guestroom_booking(
    booking_id: int,
    house_id: int = Depends(get_current_house_id),
):
    deleted = guestroom_service.delete_booking(booking_id, house_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"status": "ok"}
