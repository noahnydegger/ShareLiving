from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import laundry, dinner
from data.database import init_db
from auth import fastapi_users, auth_backend, UserRead, UserCreate


# -------------------------------------------------------------------
# App setup
# -------------------------------------------------------------------

app = FastAPI(title="ShareLiving API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# @app.on_event("startup")
# def startup_event():
#     init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


# -------------------------------------------------------------------
# Routers
# -------------------------------------------------------------------

app.include_router(laundry.router)
app.include_router(dinner.router)

# -------------------------------------------------------------------
# Auth routers
# -------------------------------------------------------------------

app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"]
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"]
)


app.mount(
    "/",
    StaticFiles(directory="frontend", html=True),
    name="frontend",
)
