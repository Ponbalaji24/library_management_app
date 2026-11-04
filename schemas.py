from datetime import date
from typing import Optional
from pydantic import BaseModel, EmailStr

# Book Schemas
class BookBase(BaseModel):
    title: str
    author: str
    isbn: str
    published_year: int
    copies_available: int = 1

class BookCreate(BookBase):
    pass

class BookResponse(BookBase):
    id: int

    class Config:
        from_attributes = True


# Member Schemas
class MemberBase(BaseModel):
    name: str
    email: EmailStr
    membership_date: date
    role: Optional[str] = "user"

class MemberCreate(MemberBase):
    password: str

class MemberResponse(MemberBase):
    id: int

    class Config:
        from_attributes = True


# Auth and Password Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class AdminRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    admin_secret: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    email: str

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str


# Borrow Schemas
class BorrowRequest(BaseModel):
    book_id: int
    member_id: Optional[int] = None  # Optional: defaults to current user if member

class BorrowRecordResponse(BaseModel):
    id: int
    book_id: int
    member_id: int
    borrow_date: date
    return_date: Optional[date] = None
    book: Optional[BookResponse] = None
    member: Optional[MemberResponse] = None

    class Config:
        from_attributes = True
