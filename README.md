# 📚 Aetheria Library Management System

A modern, full-stack **Library Management System** built with **FastAPI + PostgreSQL**, featuring a clean browser-based UI for managing books, members, and borrow/return transactions.

## Features
- 📊 Real-time Dashboard (total books, members, active borrows, available copies)
- 📖 Full Books CRUD (add, edit, delete, list)
- 👥 Member Management with secure registration
- 🔄 Borrow & Return transaction tracking
- 🔐 JWT Authentication with bcrypt password hashing
- 🗄️ PostgreSQL (Supabase) with SQLite auto-fallback

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy |
| Auth | PyJWT, bcrypt |
| Database | PostgreSQL / SQLite (fallback) |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Hosting | Render.com |

## Quick Start (Local)

```bash
# 1. Clone and enter the project
git clone <repo-url>
cd library_app

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and SECRET_KEY

# 4. Run the server
uvicorn main:app --reload
```

Open http://localhost:8000 — the app auto-seeds demo data on first launch.

**Demo login:** `john.doe@example.com` / `password123`

## Deployment
See the full step-by-step guide → deploy to **Render.com** + **Supabase** in ~15 minutes.

## API Documentation
Interactive Swagger UI available at `/docs` when the server is running.
