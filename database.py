import os
import urllib.parse
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# ── Read connection info ──────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback to individual vars if no full URL is provided
if not DATABASE_URL or "[YOUR-PASSWORD]" in DATABASE_URL or "[password]" in DATABASE_URL:
    DB_USER     = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST     = os.getenv("DB_HOST", "localhost")
    DB_PORT     = os.getenv("DB_PORT", "5432")
    DB_NAME     = os.getenv("DB_NAME", "postgres")
    encoded_pw  = urllib.parse.quote_plus(DB_PASSWORD)
    DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{encoded_pw}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# ── Normalise scheme ──────────────────────────────────────────────────────────
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# ── Create engine with resilient connection ───────────────────────────────────
try:
    print("[INFO] Attempting PostgreSQL connection...")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("[INFO] PostgreSQL connection successful.")
except Exception as e:
    print(f"[WARNING] PostgreSQL unavailable ({e}). Falling back to local SQLite database.")
    DATABASE_URL = "sqlite:///./local_library.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# ── Session & Base ────────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
