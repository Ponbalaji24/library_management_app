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
        "name": "John Doe",
        "email": "john.doe@example.com",
        "membership_date": date(2026, 1, 15),
    },
    {
        "name": "Jane Smith",
        "email": "jane.smith@example.com",
        "membership_date": date(2026, 2, 20),
    },
    {
        "name": "Alice Johnson",
        "email": "alice.j@example.com",
        "membership_date": date(2026, 3, 10),
    }
]

def seed_database(db: Session):
    # Seed books
    book_count = db.query(models.Book).count()
    if book_count == 0:
        print("Seeding books...")
        for book_data in SAMPLE_BOOKS:
            book = models.Book(**book_data)
            db.add(book)
        db.commit()

    # Seed members
    member_count = db.query(models.Member).count()
    if member_count == 0:
        print("Seeding members...")
        for member_data in SAMPLE_MEMBERS:
            data = member_data.copy()
            data["hashed_password"] = hash_password("password123")
            member = models.Member(**data)
            db.add(member)
        db.commit()
