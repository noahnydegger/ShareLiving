# CODEX.md

## Project goal

Build a shared house web app backend as a FastAPI JSON API that can later be used by a mobile app.

The backend must:
- Expose a clean REST API
- Use PostgreSQL
- Use JWT based authentication
- Take the user identity from authentication, not from request bodies
- Keep the existing structure and evolve it incrementally

A minimal client rendered frontend (vanilla JS) exists separately and talks to the API via fetch and Bearer tokens.

---

## Hard constraints (do not violate)

- Do NOT switch back to Flask.
- Do NOT reintroduce server rendered templates as the main UI.
- Do NOT collapse routers back into app.py.
- Do NOT rewrite the whole project structure.
- Do NOT pin outdated package versions.
- Prefer small, targeted changes over refactors.

---

## Required project structure (must be preserved)

ShareLiving/
  app.py
  routers/
    __init__.py
    laundry.py
    dinner.py
  services/
    __init__.py
    laundry_service.py
    dinner_service.py
  schemas/
    __init__.py
    laundry.py
    dinner.py
    user.py
  auth/
    __init__.py
    users.py
  data/
    __init__.py
    database.py
  models/
    __init__.py
    user.py
  frontend/
    index.html
    main.js
    style.css
  requirements.txt
  .env
  README.md

---

## Responsibilities

- app.py: app creation, middleware, startup events, router inclusion only
- routers/: HTTP endpoints and dependency injection
- services/: business logic and SQL
- schemas/: Pydantic models only
- auth/: fastapi users configuration only
- data/: database connection and initialization

---

## Authentication (fastapi users v14+)

Use fastapi users.

Important rules:
- Do NOT use JWTAuthentication (removed in newer versions)
- Use AuthenticationBackend, BearerTransport, and JWTStrategy
- SQLAlchemyUserDatabase is imported from fastapi_users_db_sqlalchemy
- get_register_router() requires schemas

Correct pattern:

fastapi_users.get_register_router(UserRead, UserCreate)

Authentication setup must live in auth/users.py and export:
- auth_backend
- fastapi_users
- current_user dependency

Routers must use current_user via Depends and pass user.id into services.
Request bodies must never contain user or user_id.

---

## Database rules

- PostgreSQL only
- Connection string comes from DATABASE_URL
- Do NOT assume a postgres role exists

On macOS with Homebrew:
- Default role is the macOS username
- Example local DATABASE_URL:

postgresql://<mac_username>@localhost:5432/shareliving

Tables:
- users
- laundry_bookings (user_id FK → users.id, UNIQUE(date, slot))
- dinner_attendance (user_id FK → users.id)

Avoid column name user. Use user_id.

---

## Known issues to avoid (seen in Warp)

1. get_register_router() missing schemas  
   Always pass UserRead and UserCreate

2. JWTAuthentication import error  
   Use the new authentication backend API

3. PostgreSQL role "postgres" does not exist  
   Do not hardcode postgres as the DB user

---

## Package requirements

Use recent versions only. Keep requirements minimal.

Minimum expected packages:

fastapi>=0.110
uvicorn>=0.29
fastapi-users>=14.0
fastapi-users-db-sqlalchemy>=6.0
sqlalchemy>=2.0
psycopg[binary]>=3.1
pydantic>=2.0
python-dotenv>=1.0
passlib[bcrypt]>=1.7

Do NOT paste a full pip freeze.

---

## Frontend expectations

Frontend is client rendered (vanilla JS):
- Uses fetch
- Stores JWT in localStorage
- Sends Authorization: Bearer <token>

Backend remains API only.

---

## What Codex must NOT do

- Do not move logic back into app.py
- Do not merge routers or services
- Do not downgrade packages
- Do not add heavy frameworks unless explicitly asked
- Do not assume Linux-only defaults

---

## Definition of done

- uvicorn app:app --reload starts without errors
- /docs loads
- /auth/register and /auth/jwt/login work
- Authenticated requests to /api/laundry and /api/dinner work
- PostgreSQL connects using a user-specific role
