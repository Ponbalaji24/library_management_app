import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

import urllib.parse

load_dotenv()

# Support a full connection URL or fall back to individual variables
DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback to individual variables if DATABASE_URL is empty or has placeholders
if not DATABASE_URL or "[YOUR-PASSWORD]" in DATABASE_URL or "[password]" in DATABASE_URL:
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "postgres")

    # Connection URL using PostgreSQL driver (URL-encode password for special characters like '@')
    encoded_password = urllib.parse.quote_plus(DB_PASSWORD)
    DATABASE_URL = f"postgresql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# SQLAlchemy 1.4+ requires "postgresql://" instead of "postgres://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

try:
    # Try creating the engine and verifying connection
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        pass
    print("[INFO] Successfully connected to database.")
except Exception as e:
    print(f"[WARNING] Database connection failed ({e}). Falling back to local SQLite database.")
    DATABASE_URL = "sqlite:///./local_library.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
