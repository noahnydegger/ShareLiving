from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data.database import init_db
from auth import fastapi_users, auth_backend
from routers import laundry, dinner

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


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {"message": "ShareLiving API running"}


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
    fastapi_users.get_register_router(),
    prefix="/auth",
    tags=["auth"]
)
