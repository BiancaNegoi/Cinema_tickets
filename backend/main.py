# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional, List
import sqlite3
import uvicorn
import random
from abc import ABC, abstractmethod
from factories.ticket_factory import TicketPricingFactory

app = FastAPI(title="Ticket Sales API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "tickets.db"


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: str
    location: str
    total_tickets: int
    price: float
    genre: Optional[str] = None


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
    showtime_id: Optional[int] = None
    event_id: Optional[int] = None
    customer_name: str
    customer_email: str
    quantity: int
    ticket_type: str = "standardn"


class TicketResponse(BaseModel):
    id: int
    showtime_id: int
    customer_name: str
    customer_email: str
    quantity: int
    ticket_type: str
    total_price: float
    is_paid: bool


class ShowtimeResponse(BaseModel):
    id: int
    event_id: int
    title: str
    genre: Optional[str] = None
    description: Optional[str] = None
    location: str
    start_time: str
    total_tickets: int
    available_tickets: int
    price: float


class Command(ABC):
    @abstractmethod
    def execute(self):
        pass

    @abstractmethod
    def undo(self):
        pass


class RemoveMovieCommand(Command):
    def __init__(self, cinema, event_id: int):
        self.cinema = cinema
        self.event_id = event_id
        self.saved_event = None
        self.saved_showtimes = None

    def execute(self):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM events WHERE id = ?", (self.event_id,))
        self.saved_event = cur.fetchone()
        cur.execute("SELECT * FROM showtimes WHERE event_id = ?", (self.event_id,))
        self.saved_showtimes = cur.fetchall()
        conn.close()
        if not self.saved_event:
            raise Exception("Event not found")
        self.cinema.remove_movie(self.event_id)

    def undo(self):
        if not self.saved_event:
            return
        event = self.saved_event
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO events (id, title, description, date, location, total_tickets, available_tickets, price, genre)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event["id"],
                event["title"],
                event["description"],
                event["date"],
                event["location"],
                event["total_tickets"],
                event["available_tickets"],
                event["price"],
                event["genre"],
            ),
        )
        if self.saved_showtimes:
            for s in self.saved_showtimes:
                cur.execute(
                    """
                    INSERT INTO showtimes (id, event_id, start_time, location, total_tickets, available_tickets, price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        s["id"],
                        s["event_id"],
                        s["start_time"],
                        s["location"],
                        s["total_tickets"],
                        s["available_tickets"],
                        s["price"],
                    ),
                )
        conn.commit()
        conn.close()


class CancelTicketCommand(Command):
    def __init__(self, cinema, ticket_id: int):
        self.cinema = cinema
        self.ticket_id = ticket_id
        self.saved_ticket = None

    def execute(self):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM tickets WHERE id = ?", (self.ticket_id,))
        self.saved_ticket = cur.fetchone()
        conn.close()
        if not self.saved_ticket:
            raise Exception("Ticket not found")
        self.cinema.cancel_ticket(self.ticket_id)

    def undo(self):
        if not self.saved_ticket:
            return
        t = self.saved_ticket
        self.cinema.reserve_ticket(
            int(t["showtime_id"]),
            t["customer_name"],
            t["customer_email"],
            int(t["quantity"]),
            t["ticket_type"],
        )


class Cinema:
    def add_movie(self, event: EventCreate):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO events (title, description, date, location, total_tickets, available_tickets, price, genre)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.title,
                event.description,
                event.date,
                event.location,
                event.total_tickets,
                event.total_tickets,
                event.price,
                event.genre,
            ),
        )
        event_id = cur.lastrowid
        conn.commit()
        conn.close()
        return event_id

    def remove_movie(self, event_id: int):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM tickets WHERE showtime_id IN (SELECT id FROM showtimes WHERE event_id = ?)", (event_id,))
        cur.execute("DELETE FROM showtimes WHERE event_id = ?", (event_id,))
        cur.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.commit()
        conn.close()

    def reserve_ticket(self, showtime_id: int, customer_name: str, customer_email: str, quantity: int, ticket_type: str):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM showtimes WHERE id = ?", (showtime_id,))
        showtime = cur.fetchone()
        if not showtime:
            conn.close()
            raise Exception("Showtime not found")
        if showtime["available_tickets"] < quantity:
            conn.close()
            raise Exception("Not enough tickets")

        pricing = TicketPricingFactory.create(ticket_type)
        total_price = pricing.compute_total(float(showtime["price"]), int(quantity))

        cur.execute(
            """
            INSERT INTO tickets (showtime_id, customer_name, customer_email, quantity, ticket_type, total_price, is_paid)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (showtime_id, customer_name, customer_email, quantity, ticket_type.lower(), total_price, True),
        )
        ticket_id = cur.lastrowid
        cur.execute("UPDATE showtimes SET available_tickets = available_tickets - ? WHERE id = ?", (quantity, showtime_id))
        conn.commit()
        conn.close()
        return ticket_id

    def cancel_ticket(self, ticket_id: int):
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
        ticket = cur.fetchone()
        if not ticket:
            conn.close()
            raise Exception("Ticket not found")
        cur.execute(
            "UPDATE showtimes SET available_tickets = available_tickets + ? WHERE id = ?",
            (ticket["quantity"], ticket["showtime_id"]),
        )
        cur.execute("DELETE FROM tickets WHERE id = ?", (ticket_id,))
        conn.commit()
        conn.close()


class CommandManager:
    def __init__(self):
        self.history = []
        self.redo_stack = []

    def execute(self, command: Command):
        command.execute()
        self.history.append(command)
        self.redo_stack.clear()

    def undo(self):
        if self.history:
            c = self.history.pop()
            c.undo()
            self.redo_stack.append(c)

    def redo(self):
        if self.redo_stack:
            c = self.redo_stack.pop()
            c.execute()
            self.history.append(c)


cinema = Cinema()
manager = CommandManager()


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
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
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS showtimes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            location TEXT NOT NULL,
            total_tickets INTEGER NOT NULL,
            available_tickets INTEGER NOT NULL,
            price REAL NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(event_id) REFERENCES events(id)
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tickets
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            showtime_id INTEGER NOT NULL,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            ticket_type TEXT NOT NULL,
            total_price REAL NOT NULL,
            is_paid BOOLEAN DEFAULT FALSE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(showtime_id) REFERENCES showtimes(id)
        )
        """
    )

    conn.commit()
    conn.close()


init_db()


def ensure_seeded_flag():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)")
    cur.execute("SELECT v FROM meta WHERE k='seeded'")
    row = cur.fetchone()
    conn.close()
    return row["v"] == "1" if row else False


def set_seeded_flag():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)")
    cur.execute("INSERT OR REPLACE INTO meta (k,v) VALUES ('seeded','1')")
    conn.commit()
    conn.close()


def random_showtimes_for_event(conn, event_id: int, location: str, total_tickets: int, price: float):
    base = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    k_days = random.randint(4, 8)
    days = set()
    while len(days) < k_days:
        days.add(random.randint(0, 13))
    cur = conn.cursor()
    for d in sorted(days):
        n_times = random.randint(2, 4)
        used = set()
        attempts = 0
        while len(used) < n_times and attempts < 20:
            attempts += 1
            hour = random.randint(11, 22)
            minute = random.choice([0, 15, 30, 45])
            t = (hour, minute)
            if t in used:
                continue
            used.add(t)
            start_time = (base + timedelta(days=d)).replace(hour=hour, minute=minute).isoformat()
            cur.execute(
                """
                INSERT INTO showtimes (event_id, start_time, location, total_tickets, available_tickets, price)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (event_id, start_time, location, total_tickets, total_tickets, price),
            )


@app.get("/")
def read_root():
    return {"message": "Ticket Sales API is running!"}


@app.post("/seed")
def seed():
    if ensure_seeded_flag():
        return {"message": "Already seeded"}

    conn = get_db_connection()
    cur = conn.cursor()

    now = datetime.now()
    movies = [
        ("Hamlet", "Spectacol de teatru", (now + timedelta(days=1)).isoformat(), "Florin Piersic", 200, 60.0, "Drama"),
        ("Morometii 2", "Film romanesc", (now + timedelta(days=2)).isoformat(), "Florin Piersic", 120, 25.0, "Drama"),
        ("O singura noapte", "Drama psihologica", (now + timedelta(days=3)).isoformat(), "Florin Piersic", 120, 25.0, "Drama"),
        ("Dune", "Sci-fi epic", (now + timedelta(days=1)).isoformat(), "Iulius Mall", 160, 35.0, "SF"),
        ("Spider-Man", "Actiune supereroi", (now + timedelta(days=2)).isoformat(), "VIVO Cluj", 180, 30.0, "Actiune"),
        ("Interstellar", "Calatorie spatiala", (now + timedelta(days=3)).isoformat(), "Iulius Mall", 150, 32.0, "SF"),
    ]

    event_ids = []
    for title, desc, date, loc, total, price, genre in movies:
        cur.execute(
            """
            INSERT INTO events (title, description, date, location, total_tickets, available_tickets, price, genre)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (title, desc, date, loc, total, total, price, genre),
        )
        event_ids.append((cur.lastrowid, loc, total, float(price)))

    for event_id, loc, total, price in event_ids:
        random_showtimes_for_event(conn, event_id, loc, total, price)

    conn.commit()
    conn.close()
    set_seeded_flag()
    return {"message": "Seeded"}


@app.post("/reset_showtimes")
def reset_showtimes():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM tickets")
    cur.execute("DELETE FROM showtimes")
    conn.commit()
    conn.close()
    return {"message": "cleared"}


@app.post("/migrate_events_to_showtimes")
def migrate_events_to_showtimes():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, location, total_tickets, price FROM events")
    events = cur.fetchall()

    inserted = 0
    for e in events:
        cur.execute("SELECT COUNT(*) as c FROM showtimes WHERE event_id = ?", (e["id"],))
        cnt = cur.fetchone()["c"]
        if cnt > 0:
            continue
        random_showtimes_for_event(conn, int(e["id"]), e["location"], int(e["total_tickets"]), float(e["price"]))
        inserted += 1

    conn.commit()
    conn.close()
    return {"message": "done", "events_added": inserted}


@app.get("/events/", response_model=List[EventResponse])
def get_events():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM events ORDER BY date")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/showtimes/", response_model=List[ShowtimeResponse])
def get_showtimes(location: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT s.id, s.event_id, e.title, e.genre, e.description,
               s.location, s.start_time, s.total_tickets, s.available_tickets, s.price
        FROM showtimes s
        JOIN events e ON e.id = s.event_id
        WHERE lower(s.location) = lower(?)
        ORDER BY s.start_time
        """,
        (location,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/showtimes/today", response_model=List[ShowtimeResponse])
def get_showtimes_today(location: str):
    now = datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT s.id, s.event_id, e.title, e.genre, e.description,
               s.location, s.start_time, s.total_tickets, s.available_tickets, s.price
        FROM showtimes s
        JOIN events e ON e.id = s.event_id
        WHERE lower(s.location) = lower(?)
          AND s.start_time >= ?
          AND s.start_time < ?
        ORDER BY s.start_time
        """,
        (location, start.isoformat(), end.isoformat()),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/showtimes/{showtime_id}", response_model=ShowtimeResponse)
def get_showtime(showtime_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT s.id, s.event_id, e.title, e.genre, e.description,
               s.location, s.start_time, s.total_tickets, s.available_tickets, s.price
        FROM showtimes s
        JOIN events e ON e.id = s.event_id
        WHERE s.id = ?
        """,
        (showtime_id,),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Showtime not found")
    return dict(row)


@app.post("/tickets/purchase", response_model=TicketResponse)
def purchase_ticket(ticket: TicketPurchase):
    if ticket.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be >= 1")

    conn = get_db_connection()
    cur = conn.cursor()

    showtime_id = ticket.showtime_id

    if showtime_id is None:
        if ticket.event_id is None:
            conn.close()
            raise HTTPException(status_code=400, detail="showtime_id or event_id required")

        cur.execute(
            """
            SELECT s.id
            FROM showtimes s
            JOIN events e ON e.id = s.event_id
            WHERE s.event_id = ?
            ORDER BY s.start_time
            LIMIT 1
            """,
            (ticket.event_id,),
        )
        r = cur.fetchone()
        if not r:
            conn.close()
            raise HTTPException(status_code=404, detail="Showtime not found for event")
        showtime_id = int(r["id"])

    cur.execute("SELECT * FROM showtimes WHERE id = ?", (showtime_id,))
    showtime = cur.fetchone()
    if not showtime:
        conn.close()
        raise HTTPException(status_code=404, detail="Showtime not found")

    if showtime["available_tickets"] < ticket.quantity:
        conn.close()
        raise HTTPException(status_code=400, detail="Not enough tickets")

    pricing = TicketPricingFactory.create(ticket.ticket_type)
    total_price = pricing.compute_total(float(showtime["price"]), int(ticket.quantity))

    cur.execute(
        """
        INSERT INTO tickets (showtime_id, customer_name, customer_email, quantity, ticket_type, total_price, is_paid)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            showtime_id,
            ticket.customer_name,
            ticket.customer_email,
            ticket.quantity,
            ticket.ticket_type.lower(),
            total_price,
            True,
        ),
    )

    ticket_id = cur.lastrowid

    cur.execute("UPDATE showtimes SET available_tickets = available_tickets - ? WHERE id = ?", (ticket.quantity, showtime_id))
    conn.commit()

    cur.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
    row = cur.fetchone()
    conn.close()

    return TicketResponse(
        id=row["id"],
        showtime_id=row["showtime_id"],
        customer_name=row["customer_name"],
        customer_email=row["customer_email"],
        quantity=row["quantity"],
        ticket_type=row["ticket_type"],
        total_price=row["total_price"],
        is_paid=bool(row["is_paid"]),
    )


@app.post("/events/remove/{event_id}")
def remove_movie(event_id: int):
    command = RemoveMovieCommand(cinema, event_id)
    try:
        manager.execute(command)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Movie removed successfully"}


@app.post("/tickets/cancel/{ticket_id}")
def cancel_ticket(ticket_id: int):
    command = CancelTicketCommand(cinema, ticket_id)
    try:
        manager.execute(command)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Ticket canceled successfully"}


@app.post("/commands/undo")
def undo_command():
    try:
        manager.undo()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Undo executed successfully"}


@app.post("/commands/redo")
def redo_command():
    try:
        manager.redo()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Redo executed successfully"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
