from fastapi import APIRouter, HTTPException

from schemas.house import HouseAuthOut, HouseCredentialsIn
from services.house_service import create_house, create_house_token, login_house


router = APIRouter(tags=["house"])


@router.post("/auth/house/create", response_model=HouseAuthOut)
def create_house_account(payload: HouseCredentialsIn):
    try:
        house = create_house(payload.house_name, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "token": create_house_token(house),
        "house_id": house["id"],
        "house_name": house["name"],
    }


@router.post("/auth/house/login", response_model=HouseAuthOut)
def login_house_account(payload: HouseCredentialsIn):
    house = login_house(payload.house_name, payload.password)
    if not house:
        raise HTTPException(status_code=401, detail="Invalid house name or password")

    return {
        "token": create_house_token(house),
        "house_id": house["id"],
        "house_name": house["name"],
    }
