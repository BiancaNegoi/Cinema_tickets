from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/movies")
def get_movies():
    return [
        {"id": 1, "title": "Dune 2"},
        {"id": 2, "title": "Oppenheimer"}
    ]

@app.get("/cinemas")
def get_cinemas():
    return [
        {"id": 1, "name": "Cinema City"},
        {"id": 2, "name": "Hollywood Multiplex"}
    ]

@app.post("/buy_ticket")
def buy_ticket(movie_id: int, cinema_id: int):
    return {"message": f"Bilet cumpărat pentru filmul {movie_id} la cinema {cinema_id}"}
