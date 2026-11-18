# ShareLiving

The public ShareLiving site has moved to [the new WG app](https://www.dihei.org/wg-app/).
The Fly.io deployments serve the static notice in `retirement/index.html`.
The feature and development notes below describe the original app, which remains in this repository.

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
- `POST /homes/default/api/food/batch`

### Guestroom

- `GET /homes/default/api/guestroom`
- `POST /homes/default/api/guestroom`

## Deployment

The container runs Nginx on port 8080 and serves the notice at `/` and `/index.html`.
The `/health` endpoint returns `{"status":"ok"}`. The container needs no database or authentication settings.

Run locally from the repository root:

```bash
docker build -t shareliving-transition .
docker run --rm -p 127.0.0.1:8080:8080 shareliving-transition
```

Deploy to staging and verify the notice, link, and health endpoint:

```bash
fly deploy --remote-only -c fly.staging.toml
curl -fsS https://shareliving-staging.fly.dev/
curl -fsS https://shareliving-staging.fly.dev/health
```

After staging verification and production approval, deploy the same revision:

```bash
fly deploy --remote-only -c fly.production.toml
curl -fsS https://shareliving.fly.dev/
curl -fsS https://shareliving.fly.dev/health
```

To restore the previous app, revert the retirement commit and redeploy with the restored Fly configuration.

### Legacy app database maintenance

ShareLiving accesses PostgreSQL only through FastAPI. The browser does not use the Supabase Data API directly. Apply `data/migrations/001_secure_supabase_public_tables.sql` in the Supabase SQL Editor to enable Row Level Security and remove direct access for the `anon` and `authenticated` Data API roles.

Apply the migration to staging first. Before running it, confirm that the staging `SYNC_DATABASE_URL` uses the `postgres` database role or another role with `BYPASSRLS`. After applying it, verify login and every create, read, update, and delete flow on staging before applying the same migration to production.

The migration returns two verification result sets. Every ShareLiving table should show `rowsecurity = true`, and the grants query should return no rows for `anon` or `authenticated`.

If staging FastAPI loses database access, immediately run `data/migrations/001_secure_supabase_public_tables.rollback.sql` in the staging SQL Editor. Do not use the rollback in production unless application access is broken and the cause has been confirmed.

## Current Limitations

- routes still use the fixed `/homes/default` path even though the active house is selected by token
- the frontend is intentionally simple and mostly serverless/static
- some legacy files from older experiments still exist in the repo, but the active app path is the FastAPI + `frontend/` setup

## Development Notes

- keep changes incremental
- preserve house scoping in all queries
- avoid person-level authentication unless the workflow changes
- prefer simple service and router logic over large abstractions
