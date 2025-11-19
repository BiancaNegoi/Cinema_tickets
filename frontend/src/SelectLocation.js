import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const cinemaCoords = {
  "Blue Note Club": [46.770439, 23.591423],
  "Central Park": [46.768344, 23.569347],
};

const cinemaIcon = L.divIcon({
  html: "🎬",
  className: "emoji-icon",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const styleSheet = document.createElement("style");
styleSheet.innerText = `.emoji-icon { font-size: 32px; line-height: 32px; }`;
document.head.appendChild(styleSheet);

function SelectLocation() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/events/");
      if (!response.ok) throw new Error("HTTP error " + response.status);
      const data = await response.json();

      // Eliminăm duplicatele după id
      const uniqueEvents = Array.from(new Map(data.map(e => [e.id, e])).values());

      setEvents(uniqueEvents);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const markAsSeen = (id) => {
    const seenMovies = JSON.parse(localStorage.getItem("seenMovies") || "[]");
    if (!seenMovies.includes(id)) seenMovies.push(id);
    localStorage.setItem("seenMovies", JSON.stringify(seenMovies));

    setEvents((prev) => prev.filter((event) => event.id !== id));
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div style={{ padding: "20px", background: "#ffe6f0", minHeight: "100vh" }}>
      <h1 style={{ color: "#d63384", textAlign: "center", marginBottom: "20px" }}>
        Cinema ABC - Selectează cinematograful
      </h1>

      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <select onChange={(e) => setSelectedLocation(e.target.value)} defaultValue=""
                style={{ padding: "10px 20px", borderRadius: "15px", border: "2px solid #ffb3d1", fontSize: "16px", outline: "none", cursor: "pointer" }}>
          <option value="" disabled>Select cinema on map</option>
          {events.map((event) => (
            <option key={event.id} value={event.location}>
              {event.title} - {event.location}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "center" }}>
        {events.map((event) => (
          <div key={event.id} style={{ background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", width: "220px", cursor: "pointer" }}
               onClick={() => markAsSeen(event.id)}>
            <h3 style={{ color: "#d63384", marginBottom: "10px" }}>{event.title}</h3>
            <p>📍 {event.location}</p>
            <p>🎟️ {event.available_tickets}/{event.total_tickets}</p>
            <p>💰 {event.price} lei</p>
          </div>
        ))}
      </div>

      <div style={{ height: "400px", marginTop: "40px" }}>
        <MapContainer center={[46.770, 23.590]} zoom={13} style={{ height: "100%", width: "100%", borderRadius: "15px", overflow: "hidden" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {selectedLocation && cinemaCoords[selectedLocation] && (
            <Marker position={cinemaCoords[selectedLocation]} icon={cinemaIcon}>
              <Popup>{selectedLocation}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default SelectLocation;
