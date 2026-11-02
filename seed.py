from datetime import date
from sqlalchemy.orm import Session
import models
from auth import hash_password

SAMPLE_BOOKS = [
    {
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "isbn": "9780743273565",
        "published_year": 1925,
        "copies_available": 5,
    },
    {
        "title": "To Kill a Mockingbird",
        "author": "Harper Lee",
        "isbn": "9780446310789",
        "published_year": 1960,
        "copies_available": 3,
    },
    {
        "title": "1984",
        "author": "George Orwell",
        "isbn": "9780451524935",
        "published_year": 1949,
        "copies_available": 4,
    },
    {
        "title": "The Hobbit",
        "author": "J.R.R. Tolkien",
        "isbn": "9780261102217",
        "published_year": 1937,
        "copies_available": 6,
    },
    {
        "title": "The Catcher in the Rye",
        "author": "J.D. Salinger",
        "isbn": "9780316769174",
        "published_year": 1951,
        "copies_available": 2,
    }
]

SAMPLE_MEMBERS = [
    {
        "name": "System Administrator",
        "email": "admin@library.com",
        "membership_date": date(2026, 1, 1),
        "role": "admin",
        "password": "adminpassword123",
    },
    {
        "name": "John Doe (Admin)",
        "email": "john.doe@example.com",
        "membership_date": date(2026, 1, 15),
        "role": "admin",
        "password": "password123",
    },
    {
        "name": "Jane Smith (User)",
        "email": "jane.smith@example.com",
        "membership_date": date(2026, 2, 20),
        "role": "user",
        "password": "password123",
    },
    {
        "name": "Alice Johnson (User)",
        "email": "alice.j@example.com",
        "membership_date": date(2026, 3, 10),
        "role": "user",
        "password": "password123",
    }
]

def seed_database(db: Session):
    # Seed books if empty
    book_count = db.query(models.Book).count()
    if book_count == 0:
        print("Seeding books...")
        for book_data in SAMPLE_BOOKS:
            book = models.Book(**book_data)
            db.add(book)
        db.commit()

    # Ensure admin user exists and existing users have proper roles
    for member_data in SAMPLE_MEMBERS:
        existing = db.query(models.Member).filter(models.Member.email == member_data["email"]).first()
        if not existing:
            member = models.Member(
                name=member_data["name"],
                email=member_data["email"],
                hashed_password=hash_password(member_data["password"]),
                membership_date=member_data["membership_date"],
                role=member_data["role"],
            )
            db.add(member)
        else:
            if existing.role != member_data["role"]:
                existing.role = member_data["role"]
    db.commit()
