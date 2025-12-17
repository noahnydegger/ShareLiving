import os
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import JWTAuthentication
from fastapi_users.db import SQLAlchemyUserDatabase

from data.database import get_async_session
from models.user import User

from .schemas import UserCreate, UserUpdate, UserDB

SECRET = os.environ.get("SECRET_KEY", "SECRET_KEY_CHANGE_ME")


auth_backend = JWTAuthentication(secret=SECRET, lifetime_seconds=3600)
user_db = SQLAlchemyUserDatabase(User, get_async_session())

fastapi_users = FastAPIUsers(
    user_db,
    [auth_backend],
    User,
    UserCreate,
    UserUpdate,
    UserDB,
)
