import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import chores, food, guestroom, house, laundry, people
from data.database import init_db


app = FastAPI(title="ShareLiving API")


def _get_allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ]


@app.on_event("startup")
def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# API routers
app.include_router(laundry.router, prefix="/homes/default")
app.include_router(food.router, prefix="/homes/default")
app.include_router(guestroom.router, prefix="/homes/default")
app.include_router(chores.router, prefix="/homes/default")
app.include_router(house.router, prefix="/homes/default")
app.include_router(people.router, prefix="/homes/default")

# Auth routers (temporarily disabled)

# Frontend must be mounted last
app.mount(
    "/",
    StaticFiles(directory="frontend", html=True),
    name="frontend",
)
