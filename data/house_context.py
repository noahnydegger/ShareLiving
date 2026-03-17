from typing import Optional

from fastapi import Depends, Header, HTTPException

from services.house_service import parse_house_token


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        return None
    return authorization[len(prefix):].strip()


async def get_current_house(authorization: Optional[str] = Header(default=None)) -> dict:
    token = _extract_token(authorization)
    if token:
        house = parse_house_token(token)
        if house:
            return house

    raise HTTPException(status_code=401, detail="House login required")


async def get_current_house_id(house: dict = Depends(get_current_house)) -> int:
    return house["id"]
