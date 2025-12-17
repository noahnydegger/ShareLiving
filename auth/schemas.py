from fastapi_users import schemas


class UserCreate(schemas.BaseUserCreate):
    username: str


class UserUpdate(schemas.BaseUserUpdate):
    username: str


class UserDB(schemas.BaseUserDB):
    username: str
