import os
import sys
from dotenv import load_dotenv

# Try importing dependencies
try:
    import psycopg2
    print("[SUCCESS] psycopg2-binary is installed correctly.")
except ImportError as e:
    print(f"[ERROR] Failed to import psycopg2: {e}")
    sys.exit(1)

try:
    from sqlalchemy import create_engine, text
    print("[SUCCESS] SQLAlchemy is installed correctly.")
except ImportError as e:
    print(f"[ERROR] Failed to import SQLAlchemy: {e}")
    sys.exit(1)

load_dotenv()

# We can import connection settings from database
try:
    from database import DATABASE_URL, engine
    # Safe printing (redacting password)
    if "@" in DATABASE_URL:
        redacted_url = DATABASE_URL.split("@")[-1]
    else:
        redacted_url = DATABASE_URL
    print(f"[INFO] DATABASE_URL loaded: ...@{redacted_url}")
except Exception as e:
    print(f"[ERROR] Failed to load database module: {e}")
    sys.exit(1)

# Attempt connection
try:
    print("[INFO] Attempting to connect to the database...")
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1;"))
        row = result.fetchone()
        if row and row[0] == 1:
            print("[SUCCESS] Connected to PostgreSQL/Supabase database successfully!")
        else:
            print("[WARNING] Connected, but SELECT 1 returned unexpected results.")
except Exception as e:
    print(f"[ERROR] Database connection failed: {e}")
    print("\nPlease verify that:")
    print("1. Your Supabase PostgreSQL database is active and reachable.")
    print("2. The connection credentials in the .env file are correct.")
    print("3. Your local IP address is allowed in the Supabase database settings (under Settings -> Database -> Network Constraints / IP Allowlist if enabled).")
    sys.exit(1)

# Try schema creation
try:
    print("[INFO] Attempting to create tables...")
    import models
    models.Base.metadata.create_all(bind=engine)
    print("[SUCCESS] Table schema created successfully (if not already existing)!")
except Exception as e:
    print(f"[ERROR] Failed to create tables: {e}")
    sys.exit(1)

print("\n[ALL PASSED] Database migration verification check completed successfully!")
