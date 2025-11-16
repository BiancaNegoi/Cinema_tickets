import React, { useState, useEffect } from 'react';


import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import 'leaflet/dist/leaflet.css';
import L from "leaflet";


const cinemaCoords = {
  "Blue Note Club": [46.770439, 23.591423],
  "Central Park": [46.768344, 23.569347]
};


const cinemaIcon = L.divIcon({
  html: "🎬",
  className: "emoji-icon",
  iconSize: [40, 40],
  iconAnchor: [20, 40]
});


const emojiStyle = `
  .emoji-icon {
    font-size: 32px;
    line-height: 32px;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = emojiStyle;
document.head.appendChild(styleSheet);

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await fetch('http://localhost:8000/events/');
      if (!response.ok) throw new Error('HTTP error');
      const data = await response.json();
      setEvents(data);
      setError('');
    } catch (err) {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const createSampleEvents = async () => {
    try {
      await fetch('http://localhost:8000/events/sample', {
        method: 'POST',
      });
      loadEvents();
    } catch (err) {
      setError('Failed to create events');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>CINEMA APP</h1>
      <button onClick={createSampleEvents}>Create Movies</button>
      <button onClick={loadEvents}>Refresh</button>

      <br /><br />

      {/* Dropdown to select cinema on map */}
      <select
        onChange={(e) => setSelectedLocation(e.target.value)}
        defaultValue=""
      >
        <option value="" disabled>Select cinema on map</option>
        {events.map(event => (
          <option key={event.id} value={event.location}>
            {event.title} - {event.location}
          </option>
        ))}
      </select>

      {/* Original movie list */}
      {events.map(event => (
        <div
          key={event.id}
          style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}
        >
          <h3>{event.title}</h3>
          <p>📍 {event.location}</p>
          <p>🎟️ {event.available_tickets}/{event.total_tickets}</p>
          <p>💰 ${event.price}</p>
        </div>
      ))}

      {/* Map */}
      <div style={{ height: "400px", marginTop: "20px" }}>
        <MapContainer
          center={[46.770, 23.590]} // Cluj center
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {selectedLocation && cinemaCoords[selectedLocation] && (
            <Marker 
              position={cinemaCoords[selectedLocation]}
              icon={cinemaIcon}
            >
              <Popup>{selectedLocation}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;
