from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    author = Column(String(255), nullable=False)
    isbn = Column(String(50), unique=True, index=True, nullable=False)
    published_year = Column(Integer, nullable=False)
    copies_available = Column(Integer, nullable=False, default=1)

    # Relationships
    borrow_records = relationship("BorrowRecord", back_populates="book", cascade="all, delete-orphan")


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    membership_date = Column(Date, nullable=False)
    role = Column(String(50), nullable=False, default="user")  # "admin" or "user"

    # Relationships
    borrow_records = relationship("BorrowRecord", back_populates="member", cascade="all, delete-orphan")


class BorrowRecord(Base):
    __tablename__ = "borrow_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    borrow_date = Column(Date, nullable=False)
    return_date = Column(Date, nullable=True)

    # Relationships
    book = relationship("Book", back_populates="borrow_records")
    member = relationship("Member", back_populates="borrow_records")
