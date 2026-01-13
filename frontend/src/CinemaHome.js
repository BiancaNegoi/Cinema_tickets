// frontend/src/CinemaHome.js
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

    const selected = this.selectedGenre.toLowerCase().trim();

    return list.filter((e) => {
      const movieGenre = (e.genre || "").toLowerCase().trim();
      if (selected === "actiune" && (e.title || "").toLowerCase().includes("spider")) return true;
      if (selected === "sf" && (e.title || "").toLowerCase().includes("dune")) return true;
      return movieGenre === selected;
    });
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
  const [location, setLocation] = useState(localStorage.getItem("selectedCinema") || "Iulius Mall");
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [showtimes, setShowtimes] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState("Toate");
  const [removedMovies, setRemovedMovies] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [hoveredMovie, setHoveredMovie] = useState(null);

  const navigate = useNavigate();
  const API = "http://127.0.0.1:8000";

  useEffect(() => {
    loadShowtimes();
    const savedRemovedMovies = JSON.parse(localStorage.getItem("removedMovies") || "[]");
    setRemovedMovies(savedRemovedMovies);
  }, [location]);

  const loadShowtimes = async () => {
    try {
      const res = await fetch(`${API}/showtimes/?location=${encodeURIComponent(location)}`);
      const data = await res.json();
      setShowtimes(Array.isArray(data) ? data : []);
    } catch (e) {
      setShowtimes([]);
    }
  };

  const formatHour = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  };

  const isSameDay = (a, b) => {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  const inNextDays = (iso, daysAhead) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + daysAhead);
    return d >= start && d < end;
  };

  const isTomorrow = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
};

 const movies = useMemo(() => {
  const map = new Map();
  const now = new Date();

  showtimes.forEach((s) => {
    const key = String(s.event_id);

    if (!map.has(key)) {
      map.set(key, {
        id: s.event_id,
        title: s.title,
        genre: s.genre,
        description: s.description,
        location: s.location,
        price: s.price,
        total_tickets: 0,
        available_tickets: 0,
        showtimes: [],
      });
    }

    const m = map.get(key);
    m.showtimes.push(s);

    if (Number(s.price || 0) < Number(m.price || 0)) m.price = s.price;
    if (!m.genre && s.genre) m.genre = s.genre;
    if (!m.description && s.description) m.description = s.description;
  });

  map.forEach((m) => {
    const sorted = [...m.showtimes].sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    );

    const next = sorted.find((st) => new Date(st.start_time) >= now) || sorted[0];

    m.total_tickets = Number(next?.total_tickets || 0);
    m.available_tickets = Number(next?.available_tickets || 0);
  });

  return Array.from(map.values());
}, [showtimes]);


  const genres = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => {
      const g = (m.genre || "").trim();
      if (g) set.add(g);
    });
    set.add("Actiune");
    set.add("SF");
    return [
      "Toate",
      ...Array.from(set).sort((a, b) => a.localeCompare(b, "ro", { sensitivity: "base" })),
    ];
  }, [movies]);

  const getHoursString = (movie, daysAhead) => {
    const times = new Set();
    movie.showtimes.forEach((s) => {
      if (inNextDays(s.start_time, daysAhead)) {
        const h = formatHour(s.start_time);
        if (h) times.add(h);
      }
    });
    return Array.from(times).sort().join(", ");
  };

  const getHoursForExactDay = (movie, dayOffset) => {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const start = new Date(base);
  start.setDate(start.getDate() + dayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const times = new Set();
  movie.showtimes.forEach((s) => {
    const d = new Date(s.start_time);
    if (Number.isNaN(d.getTime())) return;
    if (d >= start && d < end) {
      const h = formatHour(s.start_time);
      if (h) times.add(h);
    }
  });

  return Array.from(times).sort().join(", ");
};


  const todayMovies = useMemo(() => {
    const now = new Date();
    const result = movies.filter((m) =>
      m.showtimes.some((s) => {
        const d = new Date(s.start_time);
        if (Number.isNaN(d.getTime())) return false;
        return isSameDay(d, now);
      })
    );
    return result.filter((m) => !removedMovies.includes(m.id));
  }, [movies, removedMovies]);

  const tomorrowMovies = useMemo(() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const visible = movies.filter((m) => !removedMovies.includes(m.id));
  const onlySearch = new SearchFilterStrategy(search).filter(visible);

  return onlySearch.filter((m) =>
    m.showtimes.some((s) => {
      const d = new Date(s.start_time);
      if (Number.isNaN(d.getTime())) return false;
      return isSameDay(d, tomorrow);
    })
  );
}, [movies, search, removedMovies]);






  const filteredAndSorted = useMemo(() => {
    const visible = movies.filter((m) => !removedMovies.includes(m.id));
    const filterStrategy = new CompositeFilterStrategy([
      new SearchFilterStrategy(search),
      new GenreFilterStrategy(selectedGenre),
    ]);
    const sortStrategy = new SortByTitleAscStrategy();
    const service = new MovieListService({ filterStrategy, sortStrategy });
    return service.apply(visible);
  }, [movies, search, selectedGenre, removedMovies]);

  const changeLocation = (newLoc) => {
    localStorage.setItem("selectedCinema", newLoc);
    setLocation(newLoc);
    setShowLocationMenu(false);
    setSearch("");
    setSelectedGenre("Toate");
  };

  const hideMovie = (eventId) => {
    if (!window.confirm("Sigur vrei sa ascunzi acest film din lista? Poti face undo mai tarziu.")) return;
    const newRemoved = [...removedMovies, eventId];
    setRemovedMovies(newRemoved);
    localStorage.setItem("removedMovies", JSON.stringify(newRemoved));
    setRedoStack([]);
    alert("Film ascuns din lista! Foloseste ↩️ pentru a-l readuce.");
  };

  const handleUndo = () => {
    if (removedMovies.length === 0) {
      alert("Nu exista filme de restaurat!");
      return;
    }
    const last = removedMovies[removedMovies.length - 1];
    setRedoStack((prev) => [...prev, last]);
    const newRemoved = removedMovies.slice(0, -1);
    setRemovedMovies(newRemoved);
    localStorage.setItem("removedMovies", JSON.stringify(newRemoved));
    alert(`Film #${last} restaurat!`);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) {
      alert("Nu exista actiuni de redo!");
      return;
    }
    const last = redoStack[redoStack.length - 1];
    const newRemoved = [...removedMovies, last];
    setRemovedMovies(newRemoved);
    const newRedo = redoStack.slice(0, -1);
    setRedoStack(newRedo);
    localStorage.setItem("removedMovies", JSON.stringify(newRemoved));
    alert(`Film #${last} ascuns din nou!`);
  };

  const restoreAllMovies = () => {
    if (removedMovies.length === 0) {
      alert("Toate filmele sunt deja vizibile!");
      return;
    }
    setRemovedMovies([]);
    localStorage.removeItem("removedMovies");
    setRedoStack([]);
    alert(`Toate cele ${removedMovies.length} filme restaurate!`);
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
                Schimba cinematograful
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
                placeholder="Cauta filme..."
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

        {todayMovies.length === 0 ? (
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
            Nu exista filme programate pentru azi.
          </div>
        ) : (
          <div style={todayRow}>
            {todayMovies.map((m) => (
              <div key={`today-${m.id}`} style={todayCard}>
                <h3 style={{ color: "#d63384", margin: 0 }}>{m.title}</h3>
                <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 800 }}>📍 {m.location}</div>
                {m.genre && <div style={{ marginTop: "6px", color: "#7a0040", fontWeight: 800 }}>🏷️ {m.genre}</div>}
                <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 800 }}>
                  🎟️ {m.available_tickets}/{m.total_tickets}
                </div>
                <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 900 }}>💰 {m.price} lei</div>
                <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 900 }}>
                  🕒 {getHoursForExactDay(m, 0) || "—"}
                </div>
                <button style={primaryBtn} onClick={() => alert("Detalii vor fi implementate ulterior")}>
                  Vezi detalii
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={sectionTitle}>Mâine</div>

{tomorrowMovies.length === 0 ? (
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
    Nu există filme programate pentru mâine.
  </div>
) : (
  <div style={todayRow}>
      {tomorrowMovies.map((m) => (
      <div key={`tomorrow-${event.id}`} style={todayCard}>
        <h3 style={{ color: "#d63384", margin: 0 }}>{event.title}</h3>

        <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 800 }}>
          📍 {m.location}
        </div>

        {event.genre && (
          <div style={{ marginTop: "6px", color: "#7a0040", fontWeight: 800 }}>
            🏷️ {m.genre}
          </div>
        )}

        <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 800 }}>
          🎟️ {m.available_tickets}/{m.total_tickets}
        </div>

        <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 900 }}>
          💰 {m.price} lei
        </div>

        <div style={{ marginTop: "8px", color: "#7a0040", fontWeight: 900 }}>
                  🕒 {getHoursForExactDay(m, 1) || "—"}
                </div>

        <button
          style={primaryBtn}
          onClick={() => navigate("/buy")}
        >
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

        {removedMovies.length > 0 && (
          <div
            style={{
              background: "#fff5f5",
              padding: "10px",
              borderRadius: "12px",
              marginBottom: "15px",
              border: "1px solid #ffb3d1",
              textAlign: "center",
            }}
          >
            <span style={{ color: "#d63384", fontWeight: "bold" }}>{removedMovies.length} film(e) ascuns(e).</span>
            <button
              onClick={restoreAllMovies}
              style={{
                marginLeft: "10px",
                padding: "5px 10px",
                background: "transparent",
                border: "1px solid #d63384",
                color: "#d63384",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Restaureaza toate
            </button>
          </div>
        )}

        <div style={cardsGridStyle}>
          {filteredAndSorted.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "30px",
                background: "white",
                borderRadius: "20px",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <h3 style={{ color: "#d63384" }}>Niciun film gasit</h3>
              <p style={{ color: "#7a0040" }}>
                {selectedGenre !== "Toate"
                  ? `Nu exista filme in genul "${selectedGenre}"`
                  : "Incearca alta cautare sau restauram filme ascunse"}
              </p>
              {removedMovies.length > 0 && (
                <button
                  onClick={restoreAllMovies}
                  style={{
                    marginTop: "15px",
                    padding: "10px 20px",
                    background: "#ff77b3",
                    border: "none",
                    color: "white",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Restaurează toate filmele
                </button>
              )}
            </div>
          ) : (
            filteredAndSorted.map((m) => (
              <div key={m.id} style={cardStyle}>
                <h3 style={{ color: "#d63384" }}>{m.title}</h3>
                <p style={{ margin: "6px 0" }}>📍 {m.location}</p>
                {m.genre && <p style={{ margin: "6px 0" }}>🏷️ {m.genre}</p>}
                <p style={{ margin: "6px 0" }}>
                  🎟️ {m.available_tickets}/{m.total_tickets}
                </p>
                <p style={{ margin: "6px 0", fontWeight: 900, color: "#7a0040" }}>💰 {m.price} lei</p>
                <p style={{ margin: "6px 0", fontWeight: 900, color: "#7a0040" }}>
                  🕒 {getHoursString(m, 2) || "—"}
                </p>

                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button
                    style={{
                      ...primaryBtn,
                      background: "#ffd1e6",
                      color: "#b4005d",
                      border: "2px solid #ff77b3",
                      flex: 1,
                    }}
                    onClick={() => hideMovie(m.id)}
                  >
                    Ascunde
                  </button>

                  <div style={{ position: "relative", flex: 1 }}>
                    <button
                      style={{ ...primaryBtn, flex: 1 }}
                      onMouseEnter={() => setHoveredMovie(m)}
                      onMouseLeave={() => setHoveredMovie(null)}
                      onClick={() => {}}
                    >
                      Detalii
                    </button>

                    {hoveredMovie?.id === m.id && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "55px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: "260px",
                          background: "white",
                          borderRadius: "14px",
                          padding: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          zIndex: 5000,
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontWeight: 900, color: "#d63384", marginBottom: "6px" }}>{m.title}</div>

                        <div style={{ fontSize: "13px", color: "#7a0040", lineHeight: 1.35 }}>
                          <div>
                            <b>📍 Locație:</b> {m.location}
                          </div>
                          {m.genre ? (
                            <div>
                              <b>🏷️ Gen:</b> {m.genre}
                            </div>
                          ) : null}
                          <div>
                            <b>🕒 Urm. 2 zile:</b> {getHoursString(m, 2) || "—"}
                          </div>
                          <div>
                            <b>🎟️ Bilete:</b> {m.available_tickets}/{m.total_tickets}
                          </div>
                          <div>
                            <b>💰 Preț:</b> {m.price} lei
                          </div>
                          {m.description ? (
                            <div style={{ marginTop: "8px" }}>
                              <b>📝 Descriere:</b>
                              <div style={{ opacity: 0.9 }}>{m.description}</div>
                            </div>
                          ) : null}
                        </div>

                        <div
                          style={{
                            position: "absolute",
                            bottom: "-8px",
                            left: "50%",
                            transform: "translateX(-50%) rotate(45deg)",
                            width: "16px",
                            height: "16px",
                            background: "white",
                            borderRight: "1px solid rgba(0,0,0,0.08)",
                            borderBottom: "1px solid rgba(0,0,0,0.08)",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={stickyBottomWrap}>
        <button style={stickyBuyBtn} onClick={() => navigate("/buy")}>
          🎟️ Cumpara bilet
        </button>
      </div>

      <div
        style={{
          position: "fixed",
          right: "20px",
          bottom: "80px",
          display: "flex",
          gap: "10px",
          zIndex: 3000,
          flexDirection: "column",
        }}
      >
        <button
          onClick={handleUndo}
          disabled={removedMovies.length === 0}
          style={{
            padding: "14px",
            borderRadius: "50%",
            border: "none",
            background: removedMovies.length === 0 ? "#cccccc" : "#ff77b3",
            color: "white",
            cursor: removedMovies.length === 0 ? "not-allowed" : "pointer",
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            fontSize: "18px",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={removedMovies.length === 0 ? "Nu exista actiuni de undo" : "Undo ultima ascundere"}
        >
          ↩️
        </button>

        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          style={{
            padding: "14px",
            borderRadius: "50%",
            border: "none",
            background: redoStack.length === 0 ? "#cccccc" : "#4CAF50",
            color: "white",
            cursor: redoStack.length === 0 ? "not-allowed" : "pointer",
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            fontSize: "18px",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={redoStack.length === 0 ? "Nu exista actiuni de redo" : "Redo ultima actiune"}
        >
          ↪️
        </button>
      </div>
    </div>
  );
}
