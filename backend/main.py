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
                           id
                           INTEGER
                           PRIMARY
                           KEY
                           AUTOINCREMENT,
                           title
                           TEXT
                           NOT
                           NULL,
                           description
                           TEXT,
                           date
                           TEXT
                           NOT
                           NULL,
                           location
                           TEXT
                           NOT
                           NULL,
                           total_tickets
                           INTEGER
                           NOT
                           NULL,
                           available_tickets
                           INTEGER
                           NOT
                           NULL,
                           price
                           REAL
                           NOT
                           NULL,
                           created_at
                           TEXT
                           DEFAULT
                           CURRENT_TIMESTAMP
                       )
                       ''')

        cursor.execute('''
                       CREATE TABLE IF NOT EXISTS tickets
                       (
                           id
                           INTEGER
                           PRIMARY
                           KEY
                           AUTOINCREMENT,
                           event_id
                           INTEGER
                           NOT
                           NULL,
                           customer_name
                           TEXT
                           NOT
                           NULL,
                           customer_email
                           TEXT
                           NOT
                           NULL,
                           quantity
                           INTEGER
                           NOT
                           NULL,
                           total_price
                           REAL
                           NOT
                           NULL,
                           is_paid
                           BOOLEAN
                           DEFAULT
                           FALSE,
                           created_at
                           TEXT
                           DEFAULT
                           CURRENT_TIMESTAMP
                       )
                       ''')

        conn.commit()
        conn.close()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database error: {e}")


# Initialize database
init_db()


def get_db_connection():
    conn = sqlite3.connect('tickets.db')
    conn.row_factory = sqlite3.Row
    return conn


# Routes
@app.get("/")
def read_root():
    return {"message": "Ticket Sales API is running!", "status": "OK"}


@app.get("/events/", response_model=List[EventResponse])
def get_events():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM events ORDER BY date')
        events = cursor.fetchall()
        conn.close()

        return [
            EventResponse(
                id=event['id'],
                title=event['title'],
                description=event['description'],
                date=event['date'],
                location=event['location'],
                total_tickets=event['total_tickets'],
                available_tickets=event['available_tickets'],
                price=event['price']
            )
            for event in events
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.post("/events/sample")
def create_sample_events():
    try:
        from datetime import datetime, timedelta

        sample_events = [
            {
                "title": "Rock Concert 2024",
                "description": "Amazing rock band live performance",
                "date": (datetime.now() + timedelta(days=30)).isoformat(),
                "location": "Central Park",
                "total_tickets": 100,
                "price": 50.0
            },
            {
                "title": "Jazz Night",
                "description": "Smooth jazz evening with famous artists",
                "date": (datetime.now() + timedelta(days=15)).isoformat(),
                "location": "Blue Note Club",
                "total_tickets": 50,
                "price": 35.0
            },
            {
                "title": "Tech Conference",
                "description": "Latest technology trends and innovations",
                "date": (datetime.now() + timedelta(days=45)).isoformat(),
                "location": "Convention Center",
                "total_tickets": 200,
                "price": 25.0
            }
        ]

        conn = get_db_connection()
        cursor = conn.cursor()

        for event_data in sample_events:
            cursor.execute('''
                           INSERT INTO events (title, description, date, location, total_tickets, available_tickets,
                                               price)
                           VALUES (?, ?, ?, ?, ?, ?, ?)
                           ''', (
                               event_data["title"],
                               event_data["description"],
                               event_data["date"],
                               event_data["location"],
                               event_data["total_tickets"],
                               event_data["total_tickets"],
                               event_data["price"]
                           ))

        conn.commit()
        conn.close()

        return {"message": "Sample events created successfully", "count": len(sample_events)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating sample events: {str(e)}")


@app.post("/tickets/purchase", response_model=TicketResponse)
def purchase_ticket(ticket: TicketPurchase):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if event exists
        cursor.execute('SELECT * FROM events WHERE id = ?', (ticket.event_id,))
        event = cursor.fetchone()

        if not event:
            conn.close()
            raise HTTPException(status_code=404, detail="Event not found")

        # Check ticket availability
        if event['available_tickets'] < ticket.quantity:
            conn.close()
            raise HTTPException(status_code=400, detail="Not enough tickets available")

        # Calculate total price
        total_price = event['price'] * ticket.quantity

        # Create ticket
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

        # Update available tickets
        cursor.execute('''
                       UPDATE events
                       SET available_tickets = available_tickets - ?
                       WHERE id = ?
                       ''', (ticket.quantity, ticket.event_id))

        conn.commit()

        # Get the created ticket
        cursor.execute('SELECT * FROM tickets WHERE id = ?', (ticket_id,))
        ticket_row = cursor.fetchone()
        conn.close()

        return TicketResponse(
            id=ticket_row['id'],
            event_id=ticket_row['event_id'],
            customer_name=ticket_row['customer_name'],
            customer_email=ticket_row['customer_email'],
            quantity=ticket_row['quantity'],
            total_price=ticket_row['total_price'],
            is_paid=bool(ticket_row['is_paid'])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Purchase error: {str(e)}")


# Rulează serverul direct
if __name__ == "__main__":
    print("🚀 Starting Ticket Sales API...")
    print("📊 Available routes:")
    print("   GET  / - Health check")
    print("   GET  /events/ - Get all events")
    print("   POST /events/sample - Create sample events")
    print("   POST /tickets/purchase - Purchase tickets")
    print("🔗 Server running on: http://localhost:8000")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )