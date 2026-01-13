import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const API = "http://127.0.0.1:8000"; 

  useEffect(() => {
    loadEvents();
  }, [location]);

  const loadEvents = async () => {
    try {
      const response = await fetch(`${API}/events/`);
      const data = await response.json();

      const uniqueEvents = Array.from(new Map(data.map((e) => [e.id, e])).values());
      localStorage.removeItem("seenMovies");

      const filteredByLocation = uniqueEvents.filter(
        (e) => (e.location || "").toLowerCase() === location.toLowerCase()
      );

      setEvents(filteredByLocation);

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

  const genres = useMemo(() => {
    const set = new Set();
    events.forEach((e) => {
      const g = (e.genre || "").trim();
      if (g) set.add(g);
    });
    return [
      "Toate",
      ...Array.from(set).sort((a, b) => a.localeCompare(b, "ro", { sensitivity: "base" })),
    ];
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

  const isToday = (isoDateString) => {
    if (!isoDateString) return false;
    const d = new Date(isoDateString);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const todayEvents = useMemo(() => {
    const onlySearch = new SearchFilterStrategy(search).filter(events);
    return onlySearch.filter((e) => isToday(e.date));
  }, [events, search]);

  const changeLocation = (newLoc) => {
    localStorage.setItem("selectedCinema", newLoc);
    setLocation(newLoc);
    setShowLocationMenu(false);
    setSearch("");
    setSelectedGenre("Toate");
  };


  const handleUndo = async () => {
    try {
      const response = await fetch(`${API}/commands/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        await loadEvents();
        alert("Undo executat cu succes!");
      } else {
        const error = await response.json();
        alert(`Eroare la undo: ${error.detail}`);
      }
    } catch (err) {
      alert("Eroare de conexiune la server");
    }
  };

  const handleRedo = async () => {
    try {
      const response = await fetch(`${API}/commands/redo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        await loadEvents();
        alert("Redo executat cu succes!");
      } else {
        const error = await response.json();
        alert(`Eroare la redo: ${error.detail}`);
      }
    } catch (err) {
      alert("Eroare de conexiune la server");
    }
  };

  const handleRemoveMovie = async (eventId) => {
    if (!window.confirm("Sigur vrei să ștergi acest film? Poți face undo mai târziu.")) {
      return;
    }
    
    try {
      const response = await fetch(`${API}/events/remove/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        await loadEvents();
        alert("Film șters cu succes! Folosește butonul ↩️ pentru undo.");
      } else {
        const error = await response.json();
        alert(`Eroare: ${error.detail}`);
      }
    } catch (err) {
      alert("Eroare de conexiune la server");
    }
  };
 

  const pageStyle = {
    minHeight: "100vh",
    background: "#ffe4f0",
    fontFamily: "Arial, sans-serif",
    paddingBottom: "110px",
  };

  const topBarStyle = {
    position: "sticky",
    top: 0,
    zIndex: 2000,
    background: "rgba(255, 228, 240, 0.92)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    padding: "8px 12px",
  };

  const topBarInner = {
    maxWidth: "1000px",
    margin: "0",
    display: "flex",
    gap: "10px",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  };

  const brandBox = {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.05,
    minWidth: "160px",
    alignItems: "flex-start",
  };

  const brandTitle = {
    fontSize: "18px",
    fontWeight: 900,
    letterSpacing: "0.4px",
    color: "#b4005d",
  };

  const brandSub = {
    fontSize: "12px",
    fontWeight: 800,
    color: "#d63384",
    opacity: 0.9,
  };

  const leftControls = {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  };

  const locationPill = {
    padding: "8px 10px",
    borderRadius: "999px",
    background: "white",
    border: "1px solid rgba(0,0,0,0.06)",
    fontWeight: 800,
    color: "#b4005d",
    cursor: "pointer",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  };

  const changeBtn = {
    padding: "8px 12px",
    borderRadius: "999px",
    border: "none",
    background: "#ff99c8",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 6px 14px rgba(0,0,0,0.10)",
  };

  const rightControls = {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  };

  const searchWrap = {
    position: "relative",
    width: "360px",
    maxWidth: "100%",
  };

  const searchInputSticky = {
    padding: "10px 14px 10px 38px",
    width: "100%",
    borderRadius: "999px",
    border: "2px solid #ffb3d1",
    background: "white",
    fontSize: "14px",
    outline: "none",
  };

  const searchIcon = {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "16px",
    opacity: 0.65,
  };

  const containerStyle = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "14px 16px 0 16px",
  };

  const sectionTitle = {
    fontSize: "18px",
    fontWeight: 900,
    color: "#b4005d",
    margin: "14px 0 12px 0",
  };

  const todayRow = {
    display: "flex",
    gap: "14px",
    overflowX: "auto",
    paddingBottom: "10px",
    scrollSnapType: "x mandatory",
  };

  const todayCard = {
    minWidth: "260px",
    scrollSnapAlign: "start",
    background: "white",
    borderRadius: "20px",
    padding: "16px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
    border: "1px solid rgba(0,0,0,0.06)",
  };

  const cardsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "25px",
    marginTop: "10px",
  };

  const cardStyle = {
    background: "white",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  };

  const primaryBtn = {
    marginTop: "10px",
    padding: "10px 15px",
    width: "100%",
    background: "#ff77b3",
    border: "none",
    color: "white",
    borderRadius: "15px",
    cursor: "pointer",
    fontWeight: 900,
  };

  const genreBoxInline = {
    background: "white",
    borderRadius: "16px",
    padding: "10px 12px",
    border: "1px solid rgba(0,0,0,0.06)",
    minWidth: "240px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
  };

  const stickyBottomWrap = {
    position: "fixed",
    left: "50%",
    bottom: "18px",
    transform: "translateX(-50%)",
    zIndex: 2500,
  };

  const stickyBuyBtn = {
    padding: "14px 22px",
    borderRadius: "999px",
    border: "none",
    background: "#b4005d",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(0,0,0,0.22)",
    minWidth: "240px",
    fontSize: "16px",
  };

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <div style={topBarInner}>
          <div style={brandBox}>
            <div style={brandTitle}>{cinema.split(" ")[0] || "Cinema"}</div>
            <div style={brandSub}>{cinema.split(" ").slice(1).join(" ") || "ABC"}</div>
          </div>

          <div style={leftControls}>
            <div
              style={locationPill}
              onClick={() => {
                setShowLocationMenu(false);
                navigate("/select-location");
              }}
            >
              📍 {location}
            </div>

            <div style={{ position: "relative" }}>
              <button style={changeBtn} onClick={() => setShowLocationMenu(!showLocationMenu)}>
                Schimbă cinematograful
              </button>

              {showLocationMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "44px",
                    left: 0,
                    background: "#fff",
                    borderRadius: "12px",
                    padding: "10px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                    width: "200px",
                    zIndex: 3000,
                  }}
                >
                  {["Iulius Mall", "VIVO Cluj", "Florin Piersic"].map((loc) => (
                    <button
                      key={loc}
                      onClick={() => changeLocation(loc)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#ffb3d1",
                        marginBottom: loc !== "Florin Piersic" ? "8px" : 0,
                        cursor: "pointer",
                        fontWeight: 900,
                        color: "#7a0040",
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={rightControls}>
            <div style={searchWrap}>
              <span style={searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Caută filme..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInputSticky}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={containerStyle}>
        <div style={sectionTitle}>Astăzi</div>

        {todayEvents.length === 0 ? (
          <div
            style={{
              background: "white",
              borderRadius: "18px",
              padding: "16px",
              border: "1px solid rgba(0,0,0,0.06)",
              color: "#7a0040",
              fontWeight: 800,
            }}
          >
            Nu există filme programate pentru azi.
          </div>
        ) : (
          <div style={todayRow}>
            {todayEvents.map((event) => (
              <div key={`today-${event.id}`} style={todayCard}>
                <h3 style={{ color: "#d63384", margin: 0 }}>{event.title}</h3>
                <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 800 }}>
                  📍 {event.location}
                </div>
                {event.genre && (
                  <div style={{ marginTop: "6px", color: "#7a0040", fontWeight: 800 }}>
                    🏷️ {event.genre}
                  </div>
                )}
                <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 800 }}>
                  🎟️ {event.available_tickets}/{event.total_tickets}
                </div>
                <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 900 }}>
                  💰 {event.price} lei
                </div>

                <button style={primaryBtn} onClick={() => alert("Detalii vor fi implementate ulterior")}>
                  Vezi detalii
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginTop: "10px",
          }}
        >
          <div style={sectionTitle}>Toate filmele</div>

          <div style={genreBoxInline}>
            <div style={{ color: "#d63384", fontWeight: 900, marginBottom: "6px" }}>Gen</div>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              style={{
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
              }}
            >
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={cardsGridStyle}>
          {filteredAndSorted.map((event) => (
            <div key={event.id} style={cardStyle}>
              <h3 style={{ color: "#d63384" }}>{event.title}</h3>
              <p style={{ margin: "6px 0" }}>📍 {event.location}</p>
              {event.genre && <p style={{ margin: "6px 0" }}>🏷️ {event.genre}</p>}
              <p style={{ margin: "6px 0" }}>
                🎟️ {event.available_tickets}/{event.total_tickets}
              </p>
              <p style={{ margin: "6px 0", fontWeight: 900, color: "#7a0040" }}>
                💰 {event.price} lei
              </p>

       
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button 
                  style={{ 
                    ...primaryBtn, 
                    background: "#ff4444",
                    flex: 1 
                  }} 
                  onClick={() => handleRemoveMovie(event.id)}
                >
                  🗑️ Șterge
                </button>
                
                <button 
                  style={{ 
                    ...primaryBtn,
                    flex: 1 
                  }} 
                  onClick={() => alert("Detalii vor fi implementate ulterior")}
                >
                  👁️ Detalii
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      <div style={stickyBottomWrap}>
        <button
          style={stickyBuyBtn}
          onClick={() => navigate("/buy")}
        >
          🎟️ Cumpără bilet
        </button>
      </div>


      <div style={{ 
        position: "fixed", 
        right: "20px", 
        bottom: "80px", 
        display: "flex", 
        gap: "10px",
        zIndex: 3000,
        flexDirection: "column"
      }}>
        <button
          onClick={handleUndo}
          style={{
            padding: "14px",
            borderRadius: "50%",
            border: "none",
            background: "#ff77b3",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            fontSize: "18px",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Undo ultima acțiune"
        >
          ↩️
        </button>
        
        <button
          onClick={handleRedo}
          style={{
            padding: "14px",
            borderRadius: "50%",
            border: "none",
            background: "#4CAF50",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            fontSize: "18px",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Redo acțiune anulată"
        >
          ↪️
        </button>
      </div>

    </div>
  );
}