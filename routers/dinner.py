

from fastapi import APIRouter, Depends
from typing import Dict

import services.dinner_service as dinner_service
from schemas.dinner import DinnerUpdateIn
from auth import fastapi_users

router = APIRouter(
    prefix="/api/dinner",
    tags=["dinner"],
)


@router.get("", response_model=Dict)
def get_dinner_data(
    user=Depends(fastapi_users.current_user()),
):
    """
    Return dinner data for the current week for the authenticated user.
    """
    return dinner_service.get_dinner_data(user.id)


@router.post("")
def update_dinner(
    update: DinnerUpdateIn,
    user=Depends(fastapi_users.current_user()),
):
    """
    Update dinner preferences for the authenticated user.
    """
    dinner_service.update_dinner(user.id, update.dict())
    return {"status": "ok"}