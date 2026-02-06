

from fastapi import APIRouter, HTTPException, Query
from typing import Dict

import services.dinner_service as dinner_service
from services.user_service import get_or_create_user_id, get_user_id
from schemas.dinner import DinnerUpdateIn

router = APIRouter(
    prefix="/api/dinner",
    tags=["dinner"],
)


@router.get("", response_model=Dict)
def get_dinner_data(
    username: str = Query(...),
):
    """
    Return dinner data for the current week for the authenticated user.
    """
    if not username.strip():
        raise HTTPException(status_code=400, detail="Username is required")
    user_id = get_user_id(username)
    if user_id is None:
        return {}
    return dinner_service.get_dinner_data(user_id)


@router.post("")
def update_dinner(
    update: DinnerUpdateIn,
):
    """
    Update dinner preferences for the authenticated user.
    """
    if not update.username.strip():
        raise HTTPException(status_code=400, detail="Username is required")
    payload = update.dict()
    payload.pop("username", None)
    dinner_service.update_dinner(get_or_create_user_id(update.username), payload)
    return {"status": "ok"}
