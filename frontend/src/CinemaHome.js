import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CinemaHome() {
  const [cinema] = useState("Cinema ABC");

  // Locația curentă
  const [location, setLocation] = useState(
    localStorage.getItem("selectedCinema") || "Iulius Mall"
  );

  const [showLocationMenu, setShowLocationMenu] = useState(false);

  const [search, setSearch] = useState("");
  const [events, setEvents] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, [location]);

  useEffect(() => {
    setFiltered(
      events.filter((e) =>
        e.title.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, events]);

  // Încarcă filmele filtrate după locație
  const loadEvents = async () => {
    try {
      const response = await fetch("http://localhost:8000/events/");
      const data = await response.json();

      const uniqueEvents = Array.from(
        new Map(data.map(e => [e.id, e])).values()
      );

      localStorage.removeItem("seenMovies");

      const filteredByLocation = uniqueEvents.filter(
        (e) => e.location.toLowerCase() === location.toLowerCase()
      );

      setEvents(filteredByLocation);
      setFiltered(filteredByLocation);

    } catch (err) {
      console.log("Error loading events:", err);
    }
  };

  // Schimbă cinematograful → rămâne pe home
  const changeLocation = (newLoc) => {
    localStorage.setItem("selectedCinema", newLoc);
    setLocation(newLoc);
    setShowLocationMenu(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffe4f0", padding: "20px 40px", fontFamily: "Arial, sans-serif" }}>

      <header style={{ textAlign: "center", marginBottom: "35px" }}>
        <h1 style={{ color: "#d63384", fontSize: "3rem" }}>🎬 {cinema}</h1>

        {/* Locația curentă (poți deschide select-location de aici dacă vrei) */}
        <div
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            color: "#b4005d",
            marginTop: "5px",
            cursor: "pointer",
          }}
          onClick={() => navigate("/select-location")}
        >
          📍 {location}
        </div>

        {/* Buton schimbare cinematograf */}
        <div style={{ position: "relative", marginTop: "15px" }}>
          <button
            style={{
              padding: "10px 18px",
              borderRadius: "20px",
              border: "none",
              background: "#ff99c8",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
            }}
            onClick={() => setShowLocationMenu(!showLocationMenu)}
          >
            Schimbă cinematograful
          </button>

          {showLocationMenu && (
            <div
              style={{
                position: "absolute",
                top: "45px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#fff",
                borderRadius: "12px",
                padding: "10px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                width: "200px",
                zIndex: 100,
              }}
            >
              {/* Schimbă locația direct, fără navigate */}
              <button
                onClick={() => changeLocation("Iulius Mall")}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ffb3d1",
                  marginBottom: "8px",
                  cursor: "pointer",
                }}
              >
                Iulius Mall
              </button>

              <button
                onClick={() => changeLocation("Vivo Cluj")}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ffb3d1",
                  marginBottom: "8px",
                  cursor: "pointer",
                }}
              >
                Vivo Cluj
              </button>

              <button
                onClick={() => changeLocation("Florin Piersic")}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ffb3d1",
                  cursor: "pointer",
                }}
              >
                Florin Piersic
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Search bar */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px" }}>
        <input
          type="text"
          placeholder="Caută filme..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "12px 20px",
            width: "60%",
            borderRadius: "30px",
            border: "2px solid #ffb3d1",
            background: "white",
            fontSize: "16px",
          }}
        />
      </div>

      {/* Lista filme */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "25px" }}>
        {filtered.map((event) => (
          <div key={event.id} style={{ background: "white", borderRadius: "20px", padding: "20px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
            <h3 style={{ color: "#d63384" }}>{event.title}</h3>
            <p>📍 {event.location}</p>
            <p>🎟️ {event.available_tickets}/{event.total_tickets}</p>
            <p>💰 {event.price} lei</p>

            <button
              style={{
                marginTop: "10px",
                padding: "10px 15px",
                width: "100%",
                background: "#ff77b3",
                border: "none",
                color: "white",
                borderRadius: "15px",
                cursor: "pointer",
              }}
            >
              Vezi detalii
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
