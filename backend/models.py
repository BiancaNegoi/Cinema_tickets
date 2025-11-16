from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

Base = declarative_base()


# SQLAlchemy Models
class EventDB(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    date = Column(DateTime, nullable=False)
    location = Column(String, nullable=False)
    total_tickets = Column(Integer, nullable=False)
    available_tickets = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    created_at = Column(DateTime, default=func.now())


class TicketDB(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, nullable=False)
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    total_price = Column(Float, nullable=False)
    is_paid = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())


# Pydantic Models
class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: datetime
    location: str
    total_tickets: int
    price: float


class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    date: datetime
    location: str
    total_tickets: int
    available_tickets: int
    price: float


class TicketPurchase(BaseModel):
    event_id: int
    customer_name: str
    customer_email: str
    quantity: int


class TicketResponse(BaseModel):
    id: int
    event_id: int
    customer_name: str
    customer_email: str
    quantity: int
    total_price: float
    is_paid: bool