import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CinemaHome() {
  const [cinema] = useState("Cinema ABC");
  const [location] = useState("Iulius Mall Cluj");


  const [search, setSearch] = useState("");
  const [events, setEvents] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    setFiltered(
      events.filter((e) =>
        e.title.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, events]);

  const loadEvents = async () => {
    try {
      const response = await fetch("http://localhost:8000/events/");
      const data = await response.json();

      // Eliminăm duplicatele după id
      const uniqueEvents = Array.from(new Map(data.map(e => [e.id, e])).values());

      // Curățăm localStorage (filme vizualizate)
      localStorage.removeItem("seenMovies");

      // Filtrăm doar filmele din Iulius Mall
     const mallOnly = uniqueEvents.filter(e => e.location === "Iulius Mall");

      setEvents(mallOnly);
      setFiltered(mallOnly);

    } catch (err) {
      console.log("Error loading events:", err);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffe4f0", padding: "20px 40px", fontFamily: "Arial, sans-serif" }}>
      <header style={{ textAlign: "center", marginBottom: "35px" }}>
        <h1 style={{ color: "#d63384", fontSize: "3rem" }}>🎬 {cinema}</h1>
        <div style={{ marginTop: "10px", fontSize: "18px", cursor: "pointer", color: "#b4005d", fontWeight: "bold" }}
             onClick={() => navigate("/select-location")}>
          📍 {location}
        </div>
        <button style={{ marginTop: "10px", padding: "8px 16px", borderRadius: "20px", border: "none", background: "#ff99c8", color: "white", cursor: "pointer", fontWeight: "bold" }}>
          Schimbă locația
        </button>
      </header>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px" }}>
        <input type="text" placeholder="Caută filme..." value={search} onChange={(e) => setSearch(e.target.value)}
               style={{ padding: "12px 20px", width: "60%", borderRadius: "30px", border: "2px solid #ffb3d1", background: "white", fontSize: "16px" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "25px" }}>
        {filtered.map((event) => (
          <div key={event.id} style={{ background: "white", borderRadius: "20px", padding: "20px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
            <h3 style={{ color: "#d63384" }}>{event.title}</h3>
            <p>📍 {event.location}</p>
            <p>🎟️ {event.available_tickets}/{event.total_tickets}</p>
            <p>💰 {event.price} lei</p>
            <button style={{ marginTop: "10px", padding: "10px 15px", width: "100%", background: "#ff77b3", border: "none", color: "white", borderRadius: "15px", cursor: "pointer" }}>
              Vezi detalii
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
