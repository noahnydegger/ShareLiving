import os
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

from data.database import get_async_session
from models.user import User

from .schemas import UserCreate, UserUpdate, UserRead

SECRET = os.environ.get("SECRET_KEY", "SECRET_KEY_CHANGE_ME")

bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

async def get_user_db():
    async for session in get_async_session():
        yield SQLAlchemyUserDatabase(session, User)

fastapi_users = FastAPIUsers[User, int](
    get_user_db,
    [auth_backend],
)
