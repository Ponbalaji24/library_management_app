from datetime import date
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, func

import models
import schemas
from database import engine, get_db, SessionLocal
from seed import seed_database
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_member,
    get_current_admin
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create database tables automatically
    models.Base.metadata.create_all(bind=engine)
    
    # 2. Add 'role' column if not exists (safe SQLite & PostgreSQL migration)
    try:
        with engine.connect() as conn:
            if engine.dialect.name == "sqlite":
                result = conn.execute(text("PRAGMA table_info(members)"))
                columns = [row[1] for row in result.fetchall()]
                if "role" not in columns:
                    conn.execute(text("ALTER TABLE members ADD COLUMN role VARCHAR(50) DEFAULT 'user'"))
                    conn.commit()
            else:
                conn.execute(text("ALTER TABLE members ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';"))
                conn.commit()
    except Exception as e:
        print(f"[INFO] Column migration notice: {e}")

    # 3. Seed default admin and initial library data
    db = SessionLocal()
    try:
        seed_database(db)
    except Exception as e:
        print(f"[ERROR] Seeding notice: {e}")
    finally:
        db.close()
    yield

app = FastAPI(
    title="Library Management System API",
    description="A RESTful API for managing books, library members, and borrowing transactions with Role-Based Access.",
    version="1.1.0",
    lifespan=lifespan
)

# CORS configuration
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")


# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/auth/login", response_model=schemas.TokenResponse, tags=["Authentication"])
async def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.email == req.email).first()
    if not member or not verify_password(req.password, member.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": member.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": member.role or "user",
        "name": member.name,
        "email": member.email,
    }


@app.post("/api/auth/register", response_model=schemas.TokenResponse, status_code=201, tags=["Authentication"])
async def register(req: schemas.RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(models.Member).filter(models.Member.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_member = models.Member(
        name=req.name,
        email=req.email,
        hashed_password=hash_password(req.password),
        membership_date=date.today(),
        role="user"  # Self-registration always creates regular users
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    access_token = create_access_token(data={"sub": new_member.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": new_member.role,
        "name": new_member.name,
        "email": new_member.email,
    }


@app.post("/api/auth/register-admin", response_model=schemas.TokenResponse, status_code=201, tags=["Authentication"])
async def register_admin(req: schemas.AdminRegisterRequest, db: Session = Depends(get_db)):
    expected_secret = os.getenv("ADMIN_REGISTRATION_KEY", "ADMIN2026")
    if req.admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid Admin Secret Key. Access denied.")
    
    existing = db.query(models.Member).filter(models.Member.email == req.email).first()
    if existing:
        existing.name = req.name
        existing.hashed_password = hash_password(req.password)
        existing.role = "admin"
        db.commit()
        db.refresh(existing)
        member = existing
    else:
        new_admin = models.Member(
            name=req.name,
            email=req.email,
            hashed_password=hash_password(req.password),
            membership_date=date.today(),
            role="admin"
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        member = new_admin

    access_token = create_access_token(data={"sub": member.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": "admin",
        "name": member.name,
        "email": member.email,
    }


@app.get("/api/auth/me", tags=["Authentication"])
async def get_current_user_profile(current_member: models.Member = Depends(get_current_member)):
    return {
        "id": current_member.id,
        "name": current_member.name,
        "email": current_member.email,
        "role": current_member.role or "user",
        "membership_date": str(current_member.membership_date)
    }


@app.post("/api/auth/change-password", tags=["Authentication"])
async def change_password(req: schemas.PasswordChangeRequest, current_member: models.Member = Depends(get_current_member), db: Session = Depends(get_db)):
    if not verify_password(req.old_password, current_member.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    current_member.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ==========================================
# BOOK ENDPOINTS
# ==========================================

@app.get("/api/books", response_model=list[schemas.BookResponse], tags=["Books"])
async def list_books(db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    """Both Users and Admins can view the catalog."""
    return db.query(models.Book).order_by(models.Book.id.asc()).all()


@app.get("/api/books/{book_id}", response_model=schemas.BookResponse, tags=["Books"])
async def get_book(book_id: int, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.post("/api/books", response_model=schemas.BookResponse, status_code=201, tags=["Books - Admin Only"])
async def create_book(book: schemas.BookCreate, db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    """ADMIN ONLY: Add a new book to the catalog."""
    existing_book = db.query(models.Book).filter(models.Book.isbn == book.isbn).first()
    if existing_book:
        raise HTTPException(status_code=400, detail="ISBN already registered")
    
    db_book = models.Book(
        title=book.title,
        author=book.author,
        isbn=book.isbn,
        published_year=book.published_year,
        copies_available=book.copies_available
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book


@app.put("/api/books/{book_id}", response_model=schemas.BookResponse, tags=["Books - Admin Only"])
async def update_book(book_id: int, book: schemas.BookCreate, db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    """ADMIN ONLY: Update book details."""
    db_book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if db_book.isbn != book.isbn:
        conflicting_book = db.query(models.Book).filter(models.Book.isbn == book.isbn).first()
        if conflicting_book:
            raise HTTPException(status_code=400, detail="ISBN already in use by another book")

    db_book.title = book.title
    db_book.author = book.author
    db_book.isbn = book.isbn
    db_book.published_year = book.published_year
    db_book.copies_available = book.copies_available
    
    db.commit()
    db.refresh(db_book)
    return db_book


@app.delete("/api/books/{book_id}", tags=["Books - Admin Only"])
async def delete_book(book_id: int, db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    """ADMIN ONLY: Delete a book from catalog."""
    db_book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    db.delete(db_book)
    db.commit()
    return {"message": f"Book '{db_book.title}' deleted successfully"}


# ==========================================
# MEMBER ENDPOINTS (ADMIN ONLY)
# ==========================================

@app.get("/api/members", response_model=list[schemas.MemberResponse], tags=["Members - Admin Only"])
async def list_members(db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    """ADMIN ONLY: View all registered library members."""
    return db.query(models.Member).order_by(models.Member.id.asc()).all()


@app.get("/api/members/{member_id}", response_model=schemas.MemberResponse, tags=["Members - Admin Only"])
async def get_member(member_id: int, db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    """ADMIN ONLY: Get member details."""
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@app.post("/api/members", response_model=schemas.MemberResponse, status_code=201, tags=["Members - Admin Only"])
async def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    """ADMIN ONLY: Manually register a new member with role selection."""
    existing_member = db.query(models.Member).filter(models.Member.email == member.email).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_member = models.Member(
        name=member.name,
        email=member.email,
        hashed_password=hash_password(member.password),
        membership_date=member.membership_date,
        role=member.role or "user"
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


@app.delete("/api/members/{member_id}", tags=["Members - Admin Only"])
async def delete_member(member_id: int, db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    """ADMIN ONLY: Delete a member."""
    if member_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")

    db_member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    db.delete(db_member)
    db.commit()
    return {"message": f"Member '{db_member.name}' deleted successfully"}


# ==========================================
# BORROW & RETURN ENDPOINTS
# ==========================================

@app.get("/api/my-borrows", tags=["Transactions - User & Admin"])
async def get_my_borrow_records(db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    """Get the active and past loans of the currently logged-in user."""
    records = db.query(models.BorrowRecord).filter(
        models.BorrowRecord.member_id == current_member.id
    ).order_by(models.BorrowRecord.id.desc()).all()
    
    output = []
    for r in records:
        output.append({
            "id": r.id,
            "book_id": r.book_id,
            "book_title": r.book.title if r.book else "Unknown Book",
            "book_author": r.book.author if r.book else "Unknown",
            "borrow_date": str(r.borrow_date),
            "return_date": str(r.return_date) if r.return_date else None,
            "is_returned": r.return_date is not None
        })
    return output


@app.post("/api/borrow", response_model=schemas.BorrowRecordResponse, status_code=201, tags=["Transactions"])
async def borrow_book(req: schemas.BorrowRequest, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    # If user is not admin, they can only borrow for themselves
    target_member_id = current_member.id
    if current_member.role == "admin" and req.member_id:
        target_member_id = req.member_id

    # 1. Verify book exists and is available
    book = db.query(models.Book).filter(models.Book.id == req.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.copies_available <= 0:
        raise HTTPException(status_code=400, detail="No copies of this book are currently available")

    # 2. Check if user already has an active borrow for this book
    active = db.query(models.BorrowRecord).filter(
        models.BorrowRecord.book_id == req.book_id,
        models.BorrowRecord.member_id == target_member_id,
        models.BorrowRecord.return_date == None
    ).first()
    if active:
        raise HTTPException(status_code=400, detail="You currently have an active borrowed copy of this book")

    # 3. Create borrow record
    borrow_record = models.BorrowRecord(
        book_id=req.book_id,
        member_id=target_member_id,
        borrow_date=date.today()
    )
    
    # 4. Decrement available copies
    book.copies_available -= 1
    
    db.add(borrow_record)
    db.commit()
    db.refresh(borrow_record)
    return borrow_record


@app.post("/api/return/{record_id}", tags=["Transactions"])
async def return_book(record_id: int, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    record = db.query(models.BorrowRecord).filter(models.BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Borrow record not found")
    
    # Regular users can only return their own books
    if current_member.role != "admin" and record.member_id != current_member.id:
        raise HTTPException(status_code=403, detail="You can only return your own borrowed books")

    if record.return_date is not None:
        raise HTTPException(status_code=400, detail="Book has already been returned")

    record.return_date = date.today()
    book = db.query(models.Book).filter(models.Book.id == record.book_id).first()
    if book:
        book.copies_available += 1

    db.commit()
    db.refresh(record)
    return {"message": "Book returned successfully", "record_id": record.id}


@app.get("/api/borrows", tags=["Transactions - Admin Only"])
async def list_all_borrows(db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    """ADMIN ONLY: View all borrow transactions across all members."""
    records = db.query(models.BorrowRecord).order_by(models.BorrowRecord.id.desc()).all()
    output = []
    for r in records:
        output.append({
            "id": r.id,
            "book_id": r.book_id,
            "book_title": r.book.title if r.book else "Unknown",
            "member_id": r.member_id,
            "member_name": r.member.name if r.member else "Unknown",
            "member_email": r.member.email if r.member else "Unknown",
            "borrow_date": str(r.borrow_date),
            "return_date": str(r.return_date) if r.return_date else None,
            "status": "Returned" if r.return_date else "Borrowed"
        })
    return output


# ==========================================
# DASHBOARD STATS (ADMIN ONLY)
# ==========================================

@app.get("/api/stats", tags=["Dashboard - Admin Only"])
async def get_dashboard_stats(db: Session = Depends(get_db), current_admin: models.Member = Depends(get_current_admin)):
    total_books = db.query(models.Book).count()
    total_members = db.query(models.Member).count()
    active_borrows = db.query(models.BorrowRecord).filter(models.BorrowRecord.return_date == None).count()
    
    result = db.query(func.sum(models.Book.copies_available)).scalar()
    total_available_copies = int(result) if result is not None else 0
    
    return {
        "total_books": total_books,
        "total_members": total_members,
        "active_borrows": active_borrows,
        "available_copies": total_available_copies
    }


# ==========================================
# FRONTEND PAGES (SEPARATE USER & ADMIN LINKS)
# ==========================================

@app.get("/")
def user_home():
    """User Portal: Public / Member book browsing and personal borrowings."""
    return FileResponse("static/index.html")


@app.get("/admin")
def admin_home():
    """Admin Portal: Full administrative controls & member lists."""
    return FileResponse("static/admin.html")