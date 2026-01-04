from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import sqlite3
import uvicorn

app = FastAPI(title="Ticket Sales API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: str
    location: str
    total_tickets: int
    price: float

class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    date: str
    location: str
    genre: Optional[str] = None
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

# Database setup
def init_db():
    try:
        conn = sqlite3.connect('tickets.db')
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS events
            (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                date TEXT NOT NULL,
                location TEXT NOT NULL,
                total_tickets INTEGER NOT NULL,
                available_tickets INTEGER NOT NULL,
                price REAL NOT NULL,
                genre TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tickets
            (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                total_price REAL NOT NULL,
                is_paid BOOLEAN DEFAULT FALSE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()
        print("Database initialized.")
    except Exception as e:
        print(f"Database error: {e}")

init_db()

def get_db_connection():
    conn = sqlite3.connect('tickets.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/")
def read_root():
    return {"message": "Ticket Sales API is running!"}

@app.get("/events/", response_model=List[EventResponse])
def get_events():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events ORDER BY date")
    events = cursor.fetchall()
    conn.close()

    # Transformăm în listă de dict-uri
    events_list = [
        {
            "id": event["id"],
            "title": event["title"],
            "description": event["description"],
            "date": event["date"],
            "location": event["location"],
            "genre": event["genre"],  # ← PASUL 3 ESTE FIX ASTA
            "total_tickets": event["total_tickets"],
            "available_tickets": event["available_tickets"],
            "price": event["price"],
        }
        for event in events
    ]

    # Eliminăm duplicatele după id
    unique_events = {e['id']: e for e in events_list}.values()

    return list(unique_events)

@app.post("/events/sample")
def create_sample_events():
    try:
        from datetime import datetime, timedelta

        sample_events = [
            {
                "title": "Rock Concert",
                "description": "Live show",
                "date": (datetime.now() + timedelta(days=10)).isoformat(),
                "location": "Central Park",
                "total_tickets": 100,
                "price": 50.0
            },
            {
                "title": "Jazz Night",
                "description": "Smooth jazz",
                "date": (datetime.now() + timedelta(days=5)).isoformat(),
                "location": "Blue Note Club",
                "total_tickets": 80,
                "price": 35.0
            }
        ]

        conn = get_db_connection()
        cursor = conn.cursor()

        for event in sample_events:
            cursor.execute('''
                INSERT INTO events (title, description, date, location, total_tickets, available_tickets, price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                event["title"],
                event["description"],
                event["date"],
                event["location"],
                event["total_tickets"],
                event["total_tickets"],
                event["price"]
            ))

        conn.commit()
        conn.close()

        return {"message": "Sample events created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tickets/purchase", response_model=TicketResponse)
def purchase_ticket(ticket: TicketPurchase):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM events WHERE id = ?", (ticket.event_id,))
    event = cursor.fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event["available_tickets"] < ticket.quantity:
        raise HTTPException(status_code=400, detail="Not enough tickets")

    total_price = event["price"] * ticket.quantity

    cursor.execute('''
        INSERT INTO tickets (event_id, customer_name, customer_email, quantity, total_price, is_paid)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        ticket.event_id,
        ticket.customer_name,
        ticket.customer_email,
        ticket.quantity,
        total_price,
        True
    ))

    ticket_id = cursor.lastrowid

    cursor.execute('''
        UPDATE events
        SET available_tickets = available_tickets - ?
        WHERE id = ?
    ''', (ticket.quantity, ticket.event_id))

    conn.commit()

    cursor.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
    row = cursor.fetchone()
    conn.close()

    return TicketResponse(
        id=row["id"],
        event_id=row["event_id"],
        customer_name=row["customer_name"],
        customer_email=row["customer_email"],
        quantity=row["quantity"],
        total_price=row["total_price"],
        is_paid=bool(row["is_paid"])
    )

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
