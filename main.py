from datetime import date
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import models
import schemas
from database import engine, get_db, SessionLocal
from seed import seed_database
from auth import hash_password, verify_password, create_access_token, get_current_member

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create database tables automatically on startup if they do not exist
    models.Base.metadata.create_all(bind=engine)
    # 2. Seed default library data if the database is empty
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="Library Management System API",
    description="A RESTful API for managing books, library members, and borrowing transactions.",
    version="1.0.0",
    lifespan=lifespan
)

# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/auth/login", response_model=schemas.TokenResponse, tags=["Authentication"])
async def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.email == req.email).first()
    if not member or not verify_password(req.password, member.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access_token = create_access_token(data={"sub": member.email})
    return {"access_token": access_token, "token_type": "bearer"}


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
    return db.query(models.Book).all()


@app.get("/api/books/{book_id}", response_model=schemas.BookResponse, tags=["Books"])
async def get_book(book_id: int, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.post("/api/books", response_model=schemas.BookResponse, status_code=201, tags=["Books"])
async def create_book(book: schemas.BookCreate, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
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


@app.put("/api/books/{book_id}", response_model=schemas.BookResponse, tags=["Books"])
async def update_book(book_id: int, book: schemas.BookCreate, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
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


@app.delete("/api/books/{book_id}", tags=["Books"])
async def delete_book(book_id: int, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    db_book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    db.delete(db_book)
    db.commit()
    return {"message": f"Book '{db_book.title}' deleted successfully"}


# ==========================================
# MEMBER ENDPOINTS
# ==========================================

@app.get("/api/members", response_model=list[schemas.MemberResponse], tags=["Members"])
async def list_members(db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    return db.query(models.Member).all()


@app.get("/api/members/{member_id}", response_model=schemas.MemberResponse, tags=["Members"])
async def get_member(member_id: int, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@app.post("/api/members", response_model=schemas.MemberResponse, status_code=201, tags=["Members"])
async def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    existing_member = db.query(models.Member).filter(models.Member.email == member.email).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_member = models.Member(
        name=member.name,
        email=member.email,
        hashed_password=hash_password(member.password),
        membership_date=member.membership_date
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


@app.put("/api/members/{member_id}", response_model=schemas.MemberResponse, tags=["Members"])
async def update_member(member_id: int, member: schemas.MemberCreate, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    db_member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    if db_member.email != member.email:
        conflicting_member = db.query(models.Member).filter(models.Member.email == member.email).first()
        if conflicting_member:
            raise HTTPException(status_code=400, detail="Email already in use by another member")

    db_member.name = member.name
    db_member.email = member.email
    db_member.hashed_password = hash_password(member.password)
    db_member.membership_date = member.membership_date
    
    db.commit()
    db.refresh(db_member)
    return db_member


@app.delete("/api/members/{member_id}", tags=["Members"])
async def delete_member(member_id: int, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    db_member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    db.delete(db_member)
    db.commit()
    return {"message": f"Member '{db_member.name}' deleted successfully"}


# ==========================================
# BORROW & RETURN ENDPOINTS
# ==========================================

@app.post("/api/borrow", response_model=schemas.BorrowRecordResponse, status_code=201, tags=["Transactions"])
async def borrow_book(req: schemas.BorrowRequest, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    # 1. Verify book exists and is available
    book = db.query(models.Book).filter(models.Book.id == req.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.copies_available <= 0:
        raise HTTPException(status_code=400, detail="No copies of this book are currently available")

    # 2. Verify member exists
    member = db.query(models.Member).filter(models.Member.id == req.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # 3. Create borrowing transaction
    borrow_record = models.BorrowRecord(
        book_id=req.book_id,
        member_id=req.member_id,
        borrow_date=date.today()
    )
    
    # 4. Decrement available copies
    book.copies_available -= 1
    
    db.add(borrow_record)
    db.commit()
    db.refresh(borrow_record)
    return borrow_record


@app.post("/api/return/{record_id}", response_model=schemas.BorrowRecordResponse, tags=["Transactions"])
async def return_book(record_id: int, db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    # 1. Verify borrow record exists
    record = db.query(models.BorrowRecord).filter(models.BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Borrow record not found")
    
    # 2. Verify book has not already been returned
    if record.return_date is not None:
        raise HTTPException(status_code=400, detail="Book has already been returned")

    # 3. Mark return date and restore book copy
    record.return_date = date.today()
    book = db.query(models.Book).filter(models.Book.id == record.book_id).first()
    if book:
        book.copies_available += 1

    db.commit()
    db.refresh(record)
    return record


@app.get("/api/borrows", response_model=list[schemas.BorrowRecordResponse], tags=["Transactions"])
async def list_borrows(db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    return db.query(models.BorrowRecord).order_by(models.BorrowRecord.id.desc()).all()


# ==========================================
# DASHBOARD STATS ENDPOINT
# ==========================================

@app.get("/api/stats", tags=["Dashboard"])
async def get_dashboard_stats(db: Session = Depends(get_db), current_member: models.Member = Depends(get_current_member)):
    total_books = db.query(models.Book).count()
    total_members = db.query(models.Member).count()
    active_borrows = db.query(models.BorrowRecord).filter(models.BorrowRecord.return_date == None).count()
    
    from sqlalchemy import func
    result = db.query(func.sum(models.Book.copies_available)).scalar()
    total_available_copies = int(result) if result is not None else 0
    
    return {
        "total_books": total_books,
        "total_members": total_members,
        "active_borrows": active_borrows,
        "available_copies": total_available_copies
    }


@app.get("/")
def home():
    return {"message": "API is working"}