import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Strategy Pattern
 */
class SortByTitleAscStrategy {
  sort(list) {
    return [...list].sort((a, b) =>
      (a.title || "").localeCompare((b.title || ""), "ro", { sensitivity: "base" })
    );
  }
}

class SearchFilterStrategy {
  constructor(searchText) {
    this.searchText = (searchText || "").toLowerCase().trim();
  }
  filter(list) {
    if (!this.searchText) return list;
    return list.filter((e) => (e.title || "").toLowerCase().includes(this.searchText));
  }
}

class GenreFilterStrategy {
  constructor(selectedGenre) {
    this.selectedGenre = selectedGenre || "Toate";
  }
  filter(list) {
    if (this.selectedGenre === "Toate") return list;
    const g = this.selectedGenre.toLowerCase();
    return list.filter((e) => (e.genre || "").toLowerCase() === g);
  }
}

class CompositeFilterStrategy {
  constructor(strategies = []) {
    this.strategies = strategies;
  }
  filter(list) {
    return this.strategies.reduce((acc, s) => s.filter(acc), list);
  }
}

class MovieListService {
  constructor({ filterStrategy, sortStrategy }) {
    this.filterStrategy = filterStrategy;
    this.sortStrategy = sortStrategy;
  }
  apply(list) {
    const filtered = this.filterStrategy ? this.filterStrategy.filter(list) : list;
    const sorted = this.sortStrategy ? this.sortStrategy.sort(filtered) : filtered;
    return sorted;
  }
}

export default function CinemaHome() {
  const [cinema] = useState("Cinema ABC");

  const [location, setLocation] = useState(
    localStorage.getItem("selectedCinema") || "Iulius Mall"
  );
  const [showLocationMenu, setShowLocationMenu] = useState(false);

  const [search, setSearch] = useState("");
  const [events, setEvents] = useState([]);

  const [selectedGenre, setSelectedGenre] = useState("Toate");

  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, [location]);

  const loadEvents = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/events/");
      const data = await response.json();

      // DEBUG: dacă aici nu vezi "genre", backend-ul nu îl trimite
      console.log("API first item:", data?.[0]);

      const uniqueEvents = Array.from(new Map(data.map((e) => [e.id, e])).values());

      localStorage.removeItem("seenMovies");

      const filteredByLocation = uniqueEvents.filter(
        (e) => (e.location || "").toLowerCase() === location.toLowerCase()
      );

      setEvents(filteredByLocation);

      // dacă genul selectat nu există în cinema-ul curent, revino la "Toate"
      const availableGenres = new Set(
        filteredByLocation.map((e) => (e.genre || "").trim()).filter(Boolean)
      );
      if (selectedGenre !== "Toate" && !availableGenres.has(selectedGenre)) {
        setSelectedGenre("Toate");
      }
    } catch (err) {
      console.log("Error loading events:", err);
    }
  };

  // Genuri (din filmele curente)
  const genres = useMemo(() => {
    const set = new Set();
    events.forEach((e) => {
      const g = (e.genre || "").trim();
      if (g) set.add(g);
    });
    return ["Toate", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ro", { sensitivity: "base" }))];
  }, [events]);

  const filteredAndSorted = useMemo(() => {
    const filterStrategy = new CompositeFilterStrategy([
      new SearchFilterStrategy(search),
      new GenreFilterStrategy(selectedGenre),
    ]);
    const sortStrategy = new SortByTitleAscStrategy();

    const service = new MovieListService({ filterStrategy, sortStrategy });
    return service.apply(events);
  }, [events, search, selectedGenre]);

  const changeLocation = (newLoc) => {
    localStorage.setItem("selectedCinema", newLoc);
    setLocation(newLoc);
    setShowLocationMenu(false);

    setSearch("");
    setSelectedGenre("Toate");
  };

  // ===== styles =====
  const pageStyle = {
    minHeight: "100vh",
    background: "#ffe4f0",
    padding: "20px 20px",
    fontFamily: "Arial, sans-serif",
  };

  const containerStyle = {
    maxWidth: "1200px",
    margin: "0 auto",
  };

  const headerStyle = {
    textAlign: "center",
    marginBottom: "18px",
  };

  // rând: search stânga + gen dreapta
  const filtersRowStyle = {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: "22px",
  };

  const searchInputStyle = {
    padding: "12px 20px",
    width: "680px",
    maxWidth: "100%",
    borderRadius: "30px",
    border: "2px solid #ffb3d1",
    background: "white",
    fontSize: "16px",
  };

  const genreBoxStyle = {
    background: "white",
    borderRadius: "18px",
    padding: "12px 14px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    minWidth: "240px",
  };

  const genreSelectStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "2px solid #ffb3d1",
    outline: "none",
    fontSize: "14px",
    color: "#b4005d",
    fontWeight: "bold",
    background: "white",
    cursor: "pointer",
  };

  const cardsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "25px",
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={{ color: "#d63384", fontSize: "3rem", marginBottom: "8px" }}>
            🎬 {cinema}
          </h1>

          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#b4005d",
              cursor: "pointer",
              marginBottom: "10px",
            }}
            onClick={() => navigate("/select-location")}
          >
            📍 {location}
          </div>

          <div style={{ position: "relative", display: "inline-block" }}>
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
                  zIndex: 1000,
                }}
              >
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

        {/* ✅ rând frumos: Search + Gen */}
        <div style={filtersRowStyle}>
          <input
            type="text"
            placeholder="Caută filme..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
          />

          <div style={genreBoxStyle}>
            <div style={{ color: "#d63384", fontWeight: "bold", marginBottom: "8px" }}>
              Gen
            </div>

            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              style={genreSelectStyle}
            >
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista filme */}
        <div style={cardsGridStyle}>
          {filteredAndSorted.map((event) => (
            <div
              key={event.id}
              style={{
                background: "white",
                borderRadius: "20px",
                padding: "20px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              }}
            >
              <h3 style={{ color: "#d63384" }}>{event.title}</h3>
              <p>📍 {event.location}</p>
              {event.genre && <p>🏷️ {event.genre}</p>}
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
    </div>
  );
}
