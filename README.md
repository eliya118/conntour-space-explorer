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

- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend**: React + TypeScript + Tailwind CSS
- **Infrastructure**: Docker Compose, Nginx, uv (Python package manager)

## Project Structure

```
space-explorer/
├── backend/                  # FastAPI backend
│   ├── app.py                # App setup, middleware, router registration
│   ├── models.py             # Pydantic domain models
│   ├── pyproject.toml        # Python dependencies (uv)
│   ├── Dockerfile            # Backend Docker image
│   ├── controllers/          # HTTP routing layer
│   │   └── source.py         # Source routes (APIRouter)
│   ├── db/                   # Database layer
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   └── session.py        # Database session management
│   ├── repositories/         # Data access layer
│   │   ├── base.py           # Generic Repository interface
│   │   └── source.py         # PostgreSQL implementation
│   ├── scripts/              # Utility scripts
│   │   └── seed_db.py        # Database seeding from mock data
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
- Start PostgreSQL database (seeded with NASA images from `mock_data.json`)
- Build and start the FastAPI backend on http://localhost:5001
- Build and start the React frontend (served via Nginx) on http://localhost:3001

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

4. Seed the database:
   ```bash
   uv run python scripts/seed_db.py
   ```

5. Run the server:
   ```bash
   uv run uvicorn app:app --reload --port 5001
   ```

   The backend will run on http://localhost:5001
   - API docs available at http://localhost:5001/docs

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

---


## Cool Feature: Similar images

1. **Feature name**: Similar images
2. **Why this feature**: A search gets you into the collection, but the next interesting image is often one that shares a mission, place, or instrument. Opening an image and seeing related ones, each with a confidence score, lets someone explore without writing another query.
3. **Implementation details**: Similar images use the same keyword-overlap scorer as search. The query is the open image's title plus its NASA keywords. Each other image earns points when a token appears in its title (weight 3), keywords (weight 2), or description (weight 1). Confidence is those points divided by the maximum title score, so a full title match is 1. The image itself is excluded, and the result is not written to search history. The detail panel shows metadata (`nasa_id`, type, status, date, description, keywords) above a paged, virtualized list of similar images, so only the visible rows are rendered and the next page loads as you reach the end.
4. **Demo**: Open any image card, then scroll the Similar images list in the panel. A Mars image surfaces other Mars images with a match percentage.

![Search results for images of Mars rovers](docs/search-mars.png)

![Gale Crater detail with similar images](docs/similar-images.png)

Search itself is the same scorer. Queries such as "images of Mars rovers" ignore stopwords (`images`, `of`, `the`, `photo`) and rank the remaining words. Empty or stopword-only queries are rejected and do not create a history row.

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
