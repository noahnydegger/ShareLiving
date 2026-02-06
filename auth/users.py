import os
from fastapi import Depends
from fastapi_users import FastAPIUsers
from fastapi_users.manager import BaseUserManager
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

from data.database import get_async_session
from models.user import User
from schemas.user import UserCreate, UserRead, UserUpdate


# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

SECRET = os.environ.get("SECRET_KEY", "CHANGE_ME_SECRET_KEY")


# -------------------------------------------------------------------
# Authentication backend (JWT)
# -------------------------------------------------------------------

bearer_transport = BearerTransport(
    tokenUrl="/auth/jwt/login"
)

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=SECRET,
        lifetime_seconds=3600,
    )

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)


# -------------------------------------------------------------------
# User database adapter
# -------------------------------------------------------------------

async def get_user_db():
    async for session in get_async_session():
        yield SQLAlchemyUserDatabase(session, User)


# -------------------------------------------------------------------
# User manager
# -------------------------------------------------------------------

class UserManager(BaseUserManager[User, int]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET


async def get_user_manager(
    user_db=Depends(get_user_db),
):
    yield UserManager(user_db)


# -------------------------------------------------------------------
# FastAPI Users wiring
# -------------------------------------------------------------------

fastapi_users = FastAPIUsers[User, int](
    get_user_manager,
    [auth_backend],
)

current_user = fastapi_users.current_user(active=True)