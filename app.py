from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import laundry, dinner, guestroom
from data.database import init_db


app = FastAPI(title="ShareLiving API")


@app.on_event("startup")
def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# API routers
app.include_router(laundry.router, prefix="/homes/default")
app.include_router(dinner.router, prefix="/homes/default")
app.include_router(guestroom.router, prefix="/homes/default")

# Auth routers (temporarily disabled)

# Frontend must be mounted last
app.mount(
    "/",
    StaticFiles(directory="frontend", html=True),
    name="frontend",
)
