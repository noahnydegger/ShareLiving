from data.database import get_default_house_id

_default_house_id = None


async def get_current_house_id() -> int:
    global _default_house_id
    if _default_house_id is None:
        _default_house_id = get_default_house_id()
    return _default_house_id


async def get_current_house() -> dict:
    return {"id": await get_current_house_id(), "slug": "default"}
