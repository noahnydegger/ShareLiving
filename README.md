# ShareLiving

ShareLiving is a small FastAPI app for shared houses and living groups.
It is built around a house-based workflow:

- people log in as a house, not as individual users
- each house manages its own people and living groups
- one selected person is used by default when creating shared entries
- all data is scoped to the active house

The project currently includes:

- house creation and house login
- living group and person management
- laundry bookings
- food planning for lunch, dinner, and Sunday brunch
- guestroom bookings

## Tech Stack

- FastAPI
- PostgreSQL
- psycopg
- simple static frontend (`frontend/`)
- Docker and Fly.io deployment support

## How It Works

The app keeps routing under `/homes/default`, but the actual active house is resolved from a signed house token.

Typical flow:

1. Create a house or log in with an existing house name and password.
2. Add living groups and people for that house.
3. Select the current person in the frontend.
4. Use the feature pages to create entries for the selected person.

There is no person-level password or user account system in the active workflow.

## Features

### House Management

- create a house with a hashed password
- log in as a house
- add living groups
- add people and optionally assign them to a living group
- persist the selected current person in `localStorage`

### Laundry

- create laundry bookings per person
- list house-scoped laundry bookings

### Food

- create or update food entries by:
  - person
  - date
  - meal type (`lunch`, `dinner`, `brunch`)
- set:
  - `eats`
  - `cooks`
  - `cook_helper`
  - guests
  - leftovers for lunch
  - eating time
  - cooking group
  - notes
- brunch is restricted to Sundays
- summary endpoint returns total eaters and cooks per meal

### Guestroom

- create and list guestroom bookings

## Project Structure

```text
.
├── app.py
├── data/
│   ├── database.py
│   └── house_context.py
├── frontend/
│   ├── index.html
│   ├── main.js
│   └── style.css
├── routers/
│   ├── food.py
│   ├── guestroom.py
│   ├── house.py
│   ├── laundry.py
│   └── people.py
├── schemas/
│   ├── food.py
│   ├── guestroom.py
│   ├── house.py
│   ├── laundry.py
│   └── people.py
└── services/
    ├── food_service.py
    ├── guestroom_service.py
    ├── house_service.py
    ├── laundry_service.py
    └── people_service.py
```

## Environment Variables

Create a `.env` file with at least:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST/shareliving
SYNC_DATABASE_URL=postgresql://USER:PASSWORD@HOST/shareliving
HOUSE_TOKEN_SECRET=replace-this-in-production
HOUSE_TOKEN_TTL_SECONDS=604800
ALLOWED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000
```

Notes:

- `DATABASE_URL` is used for async SQLAlchemy setup when available.
- `SYNC_DATABASE_URL` is used by the current synchronous psycopg queries.
- `HOUSE_TOKEN_SECRET` is used to sign the house session token.
- `HOUSE_TOKEN_TTL_SECONDS` controls how long a house token remains valid.
- `ALLOWED_ORIGINS` is a comma-separated list of browser origins allowed by CORS.

## Local Development

### 1. Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Start PostgreSQL

Make sure a PostgreSQL database named `shareliving` exists and is reachable from the values in `.env`.

### 3. Run the app

```bash
uvicorn app:app --reload
```

Open:

- frontend: `http://127.0.0.1:8000`
- health check: `http://127.0.0.1:8000/health`

The database schema is initialized automatically on startup.

## API Overview

All active feature routes are mounted under `/homes/default`.

### House Auth

- `POST /homes/default/auth/house/create`
- `POST /homes/default/auth/house/login`

### House Data

- `GET /homes/default/api/living-groups`
- `POST /homes/default/api/living-groups`
- `GET /homes/default/api/people`
- `POST /homes/default/api/people`

### Laundry

- `GET /homes/default/api/laundry`
- `POST /homes/default/api/laundry`

### Food

- `GET /homes/default/api/food?start_date=&end_date=`
- `GET /homes/default/api/food/summary?start_date=&end_date=`
- `POST /homes/default/api/food`

### Guestroom

- `GET /homes/default/api/guestroom`
- `POST /homes/default/api/guestroom`

## Deployment

This repo includes:

- `Dockerfile` for container builds
- `fly.toml` for Fly.io deployment
- `fly.staging.toml` for Fly.io staging deployment

The Fly app is configured to run:

```bash
/app/.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8080
```

Before deploying, set production secrets for:

- database connection strings
- `HOUSE_TOKEN_SECRET`
- `HOUSE_TOKEN_TTL_SECONDS`
- `ALLOWED_ORIGINS`

## Fly Production + Staging

The repo is now set up for two Fly apps:

- production via [`fly.toml`](/Users/noahnydegger/GitHub/Websites/ShareLiving/fly.toml) on the `main` branch
- staging via [`fly.staging.toml`](/Users/noahnydegger/GitHub/Websites/ShareLiving/fly.staging.toml) on the `develop` branch

GitHub Actions:

- [`.github/workflows/fly-deploy.yml`](/Users/noahnydegger/GitHub/Websites/ShareLiving/.github/workflows/fly-deploy.yml) deploys production on pushes to `main`
- [`.github/workflows/fly-deploy-staging.yml`](/Users/noahnydegger/GitHub/Websites/ShareLiving/.github/workflows/fly-deploy-staging.yml) deploys staging on pushes to `develop`

### One-time staging setup

1. Create a second Fly app:

```bash
flyctl apps create shareliving-staging
```

2. Create a separate Supabase project for staging and copy both connection strings:

- pooled or async URL for `DATABASE_URL`
- direct PostgreSQL URL for `SYNC_DATABASE_URL`

3. Set staging secrets on the Fly staging app:

```bash
flyctl secrets set \
  DATABASE_URL="postgresql+asyncpg://..." \
  SYNC_DATABASE_URL="postgresql://..." \
  HOUSE_TOKEN_SECRET="replace-with-a-different-secret" \
  HOUSE_TOKEN_TTL_SECONDS="604800" \
  ALLOWED_ORIGINS="https://shareliving-staging.fly.dev" \
  -a shareliving-staging
```

4. Deploy staging once manually to verify everything:

```bash
flyctl deploy -c fly.staging.toml
```

### Notes

- Use a different Supabase project or at least a different database for staging.
- Use a different `HOUSE_TOKEN_SECRET` for staging and production.
- If you want a custom staging domain later, update `ALLOWED_ORIGINS` to that domain too.

## Current Limitations

- routes still use the fixed `/homes/default` path even though the active house is selected by token
- the frontend is intentionally simple and mostly serverless/static
- some legacy files from older experiments still exist in the repo, but the active app path is the FastAPI + `frontend/` setup

## Development Notes

- keep changes incremental
- preserve house scoping in all queries
- avoid person-level authentication unless the workflow changes
- prefer simple service and router logic over large abstractions
