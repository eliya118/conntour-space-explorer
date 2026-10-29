# Conntour Space Explorer – Home Assignment

## Overview

Build a small web application that allows users to explore and search a set of images retrieved from NASA. The goal is to create a smooth and intelligent experience for browsing and querying these images.

---

## Requirements

1. **Browse Images**  
   - Users should be able to view all the images retrieved from the `/sources` API.  
   - The browsing experience should be clear, visually friendly, and support viewing image metadata.

2. **Search Using Natural Language**  
   - Users should be able to type free-text queries (e.g., _"images of Mars rovers"_, _"solar flares"_).  
   - The app should return a list of images that match the query, with a **confidence score** shown per result.

3. **Search History**  
   - The app should keep a history of previous user searches and the images that were returned.  
   - Users should be able to revisit past queries and view their results again.
   - Users should be able to **delete individual searches** from their history.
   - Since history can grow large over time, the UI should **support pagination** or an alternative way to handle large result sets efficiently.

4. **Special Feature**  
   - Implement **one creative feature** that showcases your full-stack skills.
   - This should be something beyond the basic requirements that demonstrates your ability to think creatively and execute technically.
   - Document the feature in your submission (see [Deliverables](#deliverables)).

---

## Notes & Suggestions

- **Implementing real machine learning or NLP is _not_ required.**  
  You can simulate search relevance and confidence scores using a basic scoring method, such as keyword overlap or a hash function.

- Focus on building an intuitive and well-structured user experience.

- Bonus points for adding filtering, pagination, or authentication — but those are not required.

---

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic
- **Frontend**: React + TypeScript + Tailwind CSS + React Query
- **Infrastructure**: Docker Compose, Nginx, uv (Python package manager)

## Project Structure

```
space-explorer/
├── backend/                  # FastAPI backend
│   ├── app.py                # App setup, middleware, router registration
│   ├── models.py             # Pydantic domain models
│   ├── pyproject.toml        # Python dependencies (uv)
│   ├── alembic.ini           # Migration configuration
│   ├── Dockerfile            # Backend Docker image
│   ├── controllers/          # HTTP routing layer
│   │   ├── filters.py        # Browse filter query params
│   │   ├── paging.py         # Shared page limit and offset
│   │   ├── search.py         # Search history routes
│   │   └── source.py         # Catalog, facets, and similar images
│   ├── db/                   # Database layer
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   └── session.py        # Database session management
│   ├── alembic/              # Versioned schema migrations
│   │   ├── env.py            # Upgrade lock and async engine
│   │   └── versions/         # Schema revisions
│   ├── repositories/         # Data access layer
│   │   ├── base.py           # Generic Repository interface
│   │   ├── search.py         # Saved search queries
│   │   └── source.py         # PostgreSQL catalog and ranked search
│   ├── services/             # Search ranking
│   │   └── scoring.py        # Keyword-overlap confidence
│   ├── scripts/              # Utility scripts
│   │   └── seed_db.py        # Database seeding from mock data
│   ├── tests/                # Filter, paging, scoring, and search tests
│   └── data/                 # Mock data
│       └── mock_data.json    # NASA images seed data
├── frontend/                 # React frontend
│   ├── src/                  # Source files
│   ├── public/               # Static files
│   ├── Dockerfile            # Production Docker image
│   ├── Dockerfile.dev        # Development Docker image
│   └── nginx.conf            # Nginx configuration
├── docker-compose.yml        # Production compose file
├── docker-compose.dev.yml    # Development compose file
└── README.md                 # This file
```

## Prerequisites

- Docker and Docker Compose
- (Optional for local development):
  - Python 3.11+
  - Node.js 20+
  - PostgreSQL 16+
  - uv (Python package installer)

---

## Quick Start with Docker Compose

### Production Mode

Build and run the entire application with a single command:

```bash
docker compose up --build
```

This will:
- Start PostgreSQL (seeded with NASA images from `mock_data.json`)
- Apply Alembic migrations when the backend starts, then serve the API on http://localhost:5001
- Build and start the React frontend (served via Nginx) on http://localhost:3001

Seeding replaces the image catalog and keeps saved searches. The catalog stores a token array for each image's title, keywords, and description. Those arrays are what search filters.

The frontend will proxy API requests to the backend automatically.

### Development Mode (with Hot Reload)

For development with hot-reloading enabled for both frontend and backend:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This enables:
- PostgreSQL database with persistent volume
- Backend: Auto-reload on Python file changes
- Frontend: React development server with hot module replacement

### Useful Docker Commands

```bash
# Start services in background
docker compose up -d

# View logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend

# Stop services
docker compose down

# Rebuild and restart a specific service
docker compose up --build backend

# Clean up everything (including volumes and database data)
docker compose down -v --rmi all

# Connect to PostgreSQL database
docker compose exec db psql -U postgres -d space_explorer
```

---

## Local Development Setup (Without Docker)

### Prerequisites

1. Install uv:

   **Mac/Linux:**
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

   **Windows (PowerShell):**
   ```powershell
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

2. Install and start PostgreSQL, then create the database:
   ```bash
   createdb space_explorer
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Set the database URL (adjust if your PostgreSQL uses different credentials):

   **Mac/Linux:**
   ```bash
   export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5433/space_explorer"
   ```

   **Windows (PowerShell):**
   ```powershell
   $env:DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5433/space_explorer"
   ```

3. Install dependencies:
   ```bash
   uv sync
   ```

4. Seed the image catalog. This recreates `sources` and leaves `searches` in place:
   ```bash
   uv run python scripts/seed_db.py
   ```

5. Run the server. Startup applies the Alembic migrations:
   ```bash
   uv run uvicorn app:app --reload --port 5001
   ```

   The backend will run on http://localhost:5001
   - API docs available at http://localhost:5001/docs

6. Run the backend tests. The ranking tests need PostgreSQL at `DATABASE_URL`:
   ```bash
   uv run pytest
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

   The frontend will run on http://localhost:3001

4. Run the frontend tests:
   ```bash
   CI=true npm test -- --watchAll=false
   ```

---


## Filtering

The browse catalog can be narrowed by a date range, NASA center, and keyword. Dates are chosen on a calendar, and both ends are inclusive. Center is chosen from the centers in the collection. The keyword menu lists every keyword in the collection, loads the next page as you scroll, and can select more than one keyword. Or matches images that include any selected keyword. And matches images that include every selected keyword. Clear filters resets the row. Filters do not change search results, similar images, or saved history. The list stays paged, and the total is the number of images that match.

## Cool Feature: Similar images

1. **Feature name**: Similar images
2. **Why this feature**: A search gets you into the collection, but the next interesting image is often one that shares a mission, place, or instrument. Opening an image and seeing related ones, each with a confidence score, lets someone explore without writing another query.
3. **Implementation details**: Similar images use the same keyword-overlap scorer and the same PostgreSQL page query as search. The query is the open image's title plus its NASA keywords. Each other image earns points when a token appears in its title (weight 3), keywords (weight 2), or description (weight 1). Confidence is those points divided by the maximum title score, so a full title match is 1. The image itself is excluded, and the result is not written to search history. The detail panel shows metadata (`nasa_id`, type, status, date, description, keywords) above a paged, virtualized list of similar images, so only the visible rows are rendered and the next page loads as you reach the end.
4. **Demo**: Search for images of Mars rovers. The query sits beside Clear filters, and each result shows a match percentage. Open Gale Crater to list similar Mars images in the detail panel.



https://github.com/user-attachments/assets/aeab2f97-8be4-462f-8259-7daf4cf3f05d


<img width="1596" height="1222" alt="Screenshot 2026-10-29 at 11 04 08" src="https://github.com/user-attachments/assets/a488b9c2-7017-49ef-b31e-8df64ec12721" />
<img width="1588" height="1226" alt="Screenshot 2026-10-29 at 11 04 24" src="https://github.com/user-attachments/assets/8767d753-5fa0-4c5a-8b37-ec13af2c803d" />



Search itself is the same scorer. The field sits to the right of the history button and to the left of the browse filters, and it runs after the query reaches three characters. Queries such as "images of Mars rovers" ignore stopwords (`images`, `of`, `the`, `photo`) and rank the remaining words. Empty or stopword-only queries are rejected and do not create a history row.

A saved search stores the query and the time it was created. Opening it again runs that query against the current catalog, so the matches and the total can change after images are reseeded. The history list does not keep a copy of the old result set. PostgreSQL ranks one page at a time: token arrays on each image are filtered with GIN indexes, scored with the same title, keyword, and description weights, and ordered by confidence, name, and id. Full-text search is not used, because stemming and `ts_rank` would change which tokens match and what the confidence is.

Migration `0001_search_query_only` adds those token columns and drops `search_results`. That table held derived scores. The query and creation time in `searches` are kept. Startup takes an advisory lock for the upgrade, so two backend processes cannot apply it at once.

## Search performance

Measured with `EXPLAIN (ANALYZE, BUFFERS)` on 20,000 synthetic images, before and after moving ranking into PostgreSQL. The seeded NASA catalog is 100 images. The larger set is only for the measurement.

Before, search loaded the whole catalog and scored it in Python. The database scan was an index scan on the primary key: planning 0.299 ms, execution 2.253 ms, 20,000 rows returned to the client. Fetching and validating those rows took 145.5 ms. Scoring then took 30.1 ms for a selective word (200 matches) and 37.3 ms for a broad word (16,000 matches). End to end, those searches were 175.6 ms and 182.8 ms, and Python held every image.

After, a page of 24 is computed in SQL. A selective word (200 of 20,000 rows, about 1%) uses the three GIN indexes. The plan is a bitmap OR of index scans, a heap scan of those 200 candidates, and a top-N heapsort. Nothing is removed by a later filter. Planning was 0.307 ms and execution 0.417 ms. The count of matches was 0.131 ms. The request returned 24 rows to Python in 4.3 ms, with a total of 200.

A broad word (16,000 of 20,000 rows) does not use the GIN indexes. The planner sequential-scans, removes 4,000 non-matches, and top-N heapsorts the remaining 16,000 so it can return 24. Planning was 0.025 ms and execution 12.059 ms. The count scan was 4.774 ms. The request still returned only 24 rows to Python, in 16.8 ms, with a total of 16,000. Forcing the indexes would not remove that work: every image that contains the token has to be scored to keep the current weights and order. That scoring and sorting step is the remaining bottleneck. Scores are not cached.

## Deliverables

- A GitHub repository with your implementation (fork this one if you'd like)
- Document your **Cool Feature** in the README:
  1. **Feature name**: What did you build?
  2. **Why this feature**: What problem does it solve for users?
  3. **Implementation details**: Key technical decisions and challenges
  4. **Demo**: Screenshots or GIFs showing it in action

## Use Your Own Stack (Optional)
If you prefer, you are **not required** to fork or use this repository. You may build your own stack—language, framework, and tooling of your choice—so long as you meet the [requirements](#requirements) above.

Feel free to organize your codebase however you like and push it to a new repository.
