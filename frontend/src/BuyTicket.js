// frontend/src/BuyTicket.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function BuyTicket() {
  const { eventId } = useParams(); // aici e showtimeId
  const navigate = useNavigate();

  const API = "http://127.0.0.1:8000";

  // =========================
  // Select mode (/buy)
  // =========================
  const [location] = useState(localStorage.getItem("selectedCinema") || "Iulius Mall");
  const [allShowtimes, setAllShowtimes] = useState([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");

  // =========================
  // Checkout mode (/buy/:showtimeId)
  // =========================
  const [showtime, setShowtime] = useState(null);

  // Buyer
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");

  // Qty + ticket type
  const [qty, setQty] = useState(1);
  const [ticketType, setTicketType] = useState("adult");

  // Payment (fake but validated)
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [exp, setExp] = useState(""); // MM/YY
  const [cvv, setCvv] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSelectMode = !eventId; // /buy
  const isCheckoutMode = !!eventId; // /buy/:id

  const [lastTicketId, setLastTicketId] = useState(null);
  const [isTicketPurchased, setIsTicketPurchased] = useState(false);

  // =========================
  // Load showtimes for /buy selection
  // =========================
  useEffect(() => {
    if (!isSelectMode) return;

    const loadShowtimes = async () => {
      try {
        const res = await fetch(`${API}/showtimes/?location=${encodeURIComponent(location)}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];

        // sort by start_time
        list.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        setAllShowtimes(list);

        // default selection
        if (list.length > 0) setSelectedShowtimeId(String(list[0].id));
      } catch (e) {
        setAllShowtimes([]);
      }
    };

    loadShowtimes();
  }, [isSelectMode, location]);

  // =========================
  // Load showtime for /buy/:showtimeId checkout
  // =========================
  useEffect(() => {
    if (!isCheckoutMode) return;

    const load = async () => {
      try {
        const res = await fetch(`${API}/showtimes/${eventId}`);
        if (!res.ok) throw new Error("not ok");
        const found = await res.json();
        setShowtime(found || null);
      } catch (e) {
        setShowtime(null);
      }
    };

    load();
  }, [isCheckoutMode, eventId]);

  // =========================
  // Helpers
  // =========================
  const total = useMemo(() => {
    if (!showtime) return 0;
    const base = Number(showtime.price || 0) * Number(qty || 0);
    if (ticketType === "student") return Math.round(base * 0.8 * 100) / 100;
    if (ticketType === "child") return Math.round(base * 0.5 * 100) / 100;
    return Math.round(base * 100) / 100;
  }, [showtime, qty, ticketType]);

  const formatCardNumber = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExp = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const validate = () => {
    setError("");
    setSuccess("");

    if (!lastName.trim()) return "Completează numele.";
    if (!firstName.trim()) return "Completează prenumele.";
    if (!email.trim()) return "Completează email-ul.";
    if (!email.includes("@")) return "Email invalid.";

    if (!showtime) return "Showtime-ul nu a fost găsit.";
    if (!qty || Number.isNaN(qty) || qty < 1) return "Cantitatea trebuie să fie >= 1.";
    if (qty > (showtime.available_tickets ?? 0)) return "Nu sunt suficiente bilete disponibile.";

    if (!cardName.trim()) return "Completează numele de pe card.";

    const digits = cardNumber.replace(/\s+/g, "");
    if (!/^\d{16}$/.test(digits)) return "Numărul cardului trebuie să aibă exact 16 cifre.";

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) return "Expirarea trebuie să fie în format MM/YY (ex: 07/29).";

    const [mmStr, yyStr] = exp.split("/");
    const mm = Number(mmStr);
    const yy = Number(yyStr);
    const now = new Date();
    const curYY = now.getFullYear() % 100;
    const curMM = now.getMonth() + 1;

    if (yy < curYY || (yy === curYY && mm < curMM)) return "Card expirat. Pune o dată de expirare validă (în viitor).";
    if (!/^\d{3}$/.test(cvv)) return "CVV trebuie să aibă exact 3 cifre.";

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        showtime_id: Number(eventId), // IMPORTANT: showtime_id (nu event_id)
        customer_name: `${firstName.trim()} ${lastName.trim()}`,
        customer_email: email.trim(),
        quantity: Number(qty),
        ticket_type: ticketType, // IMPORTANT: backend-ul tau cere asta
      };

      const res = await fetch(`${API}/tickets/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Eroare la cumpărare.");
      }

      const ticket = await res.json();

      setLastTicketId(ticket.id);
      setIsTicketPurchased(true);

      setSuccess(`✅ Bilet cumpărat cu succes! ID: ${ticket.id}. Total: ${ticket.total_price} lei`);
      setError("");

      // update local available
      setShowtime((prev) =>
        prev ? { ...prev, available_tickets: (prev.available_tickets ?? 0) - Number(qty) } : prev
      );

      setLastName("");
      setFirstName("");
      setEmail("");
      setCardName("");
      setCardNumber("");
      setExp("");
      setCvv("");
      setQty(1);
      setTicketType("adult");
    } catch (err) {
      setSuccess("");
      setError(String(err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTicket = async () => {
    if (!lastTicketId || !window.confirm("Sigur vrei să anulezi acest bilet?")) return;

    try {
      const response = await fetch(`${API}/tickets/cancel/${lastTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        // reload showtime
        const res = await fetch(`${API}/showtimes/${eventId}`);
        const found = await res.json();
        setShowtime(found || null);

        setLastTicketId(null);
        setIsTicketPurchased(false);
        setSuccess("");
        alert("✅ Bilet anulat cu succes!");
      } else {
        const error = await response.json().catch(() => ({}));
        alert(`❌ Eroare: ${error.detail || "cancel failed"}`);
      }
    } catch (err) {
      alert("❌ Eroare de conexiune la server");
    }
  };

  // =========================
  // Styles (păstrate ca la tine)
  // =========================
  const page = {
    minHeight: "100vh",
    background: "radial-gradient(1200px 600px at 20% 0%, #fff 0%, #ffe4f0 40%, #ffd1e6 100%)",
    padding: "26px 16px",
    fontFamily: "Arial, sans-serif",
    color: "#3b0030",
  };

  const container = { maxWidth: "1020px", margin: "0 auto" };

  const topBar = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "18px",
    flexWrap: "wrap",
  };

  const backBtn = {
    border: "none",
    background: "rgba(255,255,255,0.7)",
    padding: "10px 14px",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: "bold",
    color: "#b4005d",
    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
  };

  const brand = {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#d63384",
    background: "rgba(255,255,255,0.65)",
    padding: "10px 14px",
    borderRadius: "14px",
    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
  };

  const card = {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(8px)",
    borderRadius: "22px",
    padding: "18px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    border: "1px solid rgba(255,255,255,0.6)",
  };

  const sectionTitle = { color: "#d63384", marginTop: 0, marginBottom: "12px", fontSize: "18px" };

  const label = {
    display: "block",
    fontSize: "12px",
    opacity: 0.9,
    marginBottom: "6px",
    fontWeight: 800,
    color: "#6b0040",
  };

  const input = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: "14px",
    border: "2px solid #ffb3d1",
    outline: "none",
    background: "white",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };

  const pillRow = { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" };

  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(255,179,209,0.8)",
    fontSize: "12px",
    color: "#6b0040",
    fontWeight: 800,
  };

  const hr = { border: "none", borderTop: "1px solid rgba(0,0,0,0.08)", margin: "14px 0" };

  const alertBox = (type) => ({
    background: "white",
    padding: "10px 12px",
    borderRadius: "14px",
    border: type === "error" ? "1px solid rgba(220,0,0,0.25)" : "1px solid rgba(0,140,0,0.25)",
    color: type === "error" ? "crimson" : "green",
    marginBottom: "12px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
    fontWeight: 800,
  });

  const primaryBtn = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: "16px",
    border: "none",
    background: "#ff77b3",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "16px",
    boxShadow: "0 10px 24px rgba(255,119,179,0.35)",
  };

  const ghostBtn = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "16px",
    border: "2px solid #ffb3d1",
    background: "white",
    color: "#b4005d",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: "15px",
    marginTop: "10px",
  };

  const layout = { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "18px" };

  // =========================
  // /buy: SELECT SHOWTIME
  // =========================
  if (isSelectMode) {
    return (
      <div style={page}>
        <div style={container}>
          <div style={topBar}>
            <button onClick={() => navigate(-1)} style={backBtn}>
              ← Înapoi
            </button>
            <div style={brand}>🎟️ Cumpără bilet</div>
          </div>

          <div style={card}>
            <h2 style={{ margin: 0, color: "#d63384" }}>Alege showtime</h2>
            <div style={{ marginTop: "6px", fontWeight: 800, color: "#6b0040" }}>
              Cinema selectat: <span style={{ color: "#b4005d" }}>{location}</span>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={label}>Showtime</label>
              <select
                value={selectedShowtimeId}
                onChange={(e) => setSelectedShowtimeId(e.target.value)}
                style={{ ...input, cursor: "pointer" }}
                required
              >
                {allShowtimes.length === 0 ? (
                  <option value="">Nu există showtimes disponibile</option>
                ) : (
                  allShowtimes.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.title} {s.genre ? `• ${s.genre}` : ""} •{" "}
                      {new Date(s.start_time).toLocaleString("ro-RO", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      • {s.price} lei
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={pillRow}>
              <span style={pill}>📍 {location}</span>
              <span style={pill}>🎬 Showtimes: {allShowtimes.length}</span>
            </div>

            <button
              style={{ ...primaryBtn, marginTop: "16px", opacity: allShowtimes.length ? 1 : 0.6 }}
              disabled={!allShowtimes.length || !selectedShowtimeId}
              onClick={() => navigate(`/buy/${selectedShowtimeId}`)}
            >
              Continuă → Checkout
            </button>

            <button style={ghostBtn} onClick={() => navigate("/")}>
              Înapoi la Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // /buy/:showtimeId CHECKOUT
  // =========================
  return (
    <div style={page}>
      <div style={container}>
        <div style={topBar}>
          <button onClick={() => navigate(-1)} style={backBtn}>
            ← Înapoi
          </button>
          <div style={brand}>🎬 Cinema ABC • Checkout</div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <h2 style={{ margin: "0 0 6px 0", color: "#d63384" }}>
            Cumpără bilet {showtime ? `— ${showtime.title}` : ""}
          </h2>

          <div style={pillRow}>
            <span style={pill}>📍 {showtime?.location || "..."}</span>
            <span style={pill}>
              🕒 {showtime?.start_time ? new Date(showtime.start_time).toLocaleString("ro-RO") : "..."}
            </span>
            <span style={pill}>💰 {showtime ? `${showtime.price} lei / bilet` : "..."}</span>
            <span style={pill}>🎟️ Disponibile: {showtime?.available_tickets ?? "..."}</span>
            <span style={pill}>🎫 {ticketType}</span>
            {showtime?.genre ? <span style={pill}>🏷️ {showtime.genre}</span> : null}
          </div>
        </div>

        <div style={layout}>
          <div style={card}>
            <form onSubmit={handleSubmit}>
              <h3 style={sectionTitle}>Date cumpărător</h3>

              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Nume</label>
                <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Prenume</label>
                <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Email</label>
                <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
              </div>

              <div style={row2}>
                <div style={{ marginBottom: "12px" }}>
                  <label style={label}>Cantitate</label>
                  <input style={input} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} required />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={label}>Tip bilet</label>
                  <select
                    style={{ ...input, cursor: "pointer" }}
                    value={ticketType}
                    onChange={(e) => setTicketType(e.target.value)}
                    required
                  >
                    <option value="adult">Adult</option>
                    <option value="student">Student</option>
                    <option value="child">Copil</option>
                  </select>
                </div>
              </div>

              <div style={hr} />

              <h3 style={sectionTitle}>Plată (fictivă)</h3>

              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Nume pe card</label>
                <input style={input} value={cardName} onChange={(e) => setCardName(e.target.value)} required />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Număr card (16 cifre)</label>
                <input
                  style={input}
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  required
                  inputMode="numeric"
                  maxLength={19}
                />
              </div>

              <div style={row2}>
                <div style={{ marginBottom: "12px" }}>
                  <label style={label}>Expirare (MM/YY)</label>
                  <input
                    style={input}
                    placeholder="07/29"
                    value={exp}
                    onChange={(e) => setExp(formatExp(e.target.value))}
                    required
                    inputMode="numeric"
                    maxLength={5}
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={label}>CVV (3 cifre)</label>
                  <input
                    style={input}
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    required
                    inputMode="numeric"
                    maxLength={3}
                  />
                </div>
              </div>

              {error ? <div style={alertBox("error")}>{error}</div> : null}
              {success ? <div style={alertBox("success")}>{success}</div> : null}

              {isTicketPurchased && lastTicketId && (
                <div
                  style={{
                    marginTop: "12px",
                    marginBottom: "12px",
                    padding: "12px",
                    background: "#fff5f5",
                    borderRadius: "14px",
                    border: "1px solid #ffb3d1",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "14px", color: "#d63384", marginBottom: "8px", fontWeight: "bold" }}>
                    🎫 Bilet cumpărat: ID #{lastTicketId}
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelTicket}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "12px",
                      border: "2px solid #ff4444",
                      background: "white",
                      color: "#ff4444",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "14px",
                      width: "100%",
                    }}
                  >
                    ❌ Anulează acest bilet
                  </button>
                </div>
              )}

              <button type="submit" style={{ ...primaryBtn, opacity: isSubmitting ? 0.7 : 1 }} disabled={isSubmitting}>
                {isSubmitting ? "Se procesează..." : "Plătește și cumpără"}
              </button>

              <button type="button" style={ghostBtn} onClick={() => navigate("/buy")}>
                Schimbă showtime
              </button>
            </form>
          </div>

          <div style={card}>
            <h3 style={sectionTitle}>Rezumat comandă</h3>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ fontWeight: "bold" }}>{showtime?.title || "Eveniment"}</div>
              <div style={{ color: "#6b0040", fontWeight: 900 }}>{showtime ? `${showtime.price} lei` : "-"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <div style={{ opacity: 0.85 }}>Cantitate</div>
              <div style={{ fontWeight: "bold" }}>{qty}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <div style={{ opacity: 0.85 }}>Total</div>
              <div style={{ fontWeight: "bold", color: "#d63384" }}>{total} lei</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "14px", textAlign: "center", fontSize: "12px", opacity: 0.75 }}>
          © {new Date().getFullYear()} Cinema ABC • Demo checkout
        </div>
      </div>
    </div>
  );
}
