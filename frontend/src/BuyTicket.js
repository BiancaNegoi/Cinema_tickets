// frontend/src/BuyTicket.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function BuyTicket() {
  const { eventId } = useParams(); // undefined pe /buy
  const navigate = useNavigate();

  const API = "http://127.0.0.1:8000";

  // =========================
  // Select mode (/buy)
  // =========================
  const [location] = useState(localStorage.getItem("selectedCinema") || "Iulius Mall");
  const [allEvents, setAllEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");

  // =========================
  // Checkout mode (/buy/:eventId)
  // =========================
  const [event, setEvent] = useState(null);

  // Buyer
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");

  // Qty
  const [qty, setQty] = useState(1);

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
  // Load events for /buy selection
  // =========================
  useEffect(() => {
    if (!isSelectMode) return;

    const loadEvents = async () => {
      try {
        const res = await fetch(`${API}/events/`);
        const data = await res.json();

        // only from selected cinema
        const byLocation = (data || []).filter(
          (e) => (e.location || "").toLowerCase() === (location || "").toLowerCase()
        );

        // sort alphabetically
        byLocation.sort((a, b) =>
          (a.title || "").localeCompare((b.title || ""), "ro", { sensitivity: "base" })
        );

        setAllEvents(byLocation);

        // default selection
        if (byLocation.length > 0) setSelectedEventId(String(byLocation[0].id));
      } catch (e) {
        setAllEvents([]);
      }
    };

    loadEvents();
  }, [isSelectMode, location]);

  // =========================
  // Load event for /buy/:eventId checkout
  // =========================
  useEffect(() => {
    if (!isCheckoutMode) return;

    const load = async () => {
      try {
        const res = await fetch(`${API}/events/`);
        const data = await res.json();
        const found = (data || []).find((e) => String(e.id) === String(eventId));
        setEvent(found || null);
      } catch (e) {
        setEvent(null);
      }
    };

    load();
  }, [isCheckoutMode, eventId]);

  // =========================
  // Helpers
  // =========================
  const total = useMemo(() => {
    if (!event) return 0;
    return Number(event.price || 0) * Number(qty || 0);
  }, [event, qty]);

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

    // Required buyer info
    if (!lastName.trim()) return "Completează numele.";
    if (!firstName.trim()) return "Completează prenumele.";
    if (!email.trim()) return "Completează email-ul.";
    if (!email.includes("@")) return "Email invalid.";

    // Event checks
    if (!event) return "Evenimentul nu a fost găsit.";
    if (!qty || Number.isNaN(qty) || qty < 1) return "Cantitatea trebuie să fie >= 1.";
    if (qty > (event.available_tickets ?? 0)) return "Nu sunt suficiente bilete disponibile.";

    // Payment required
    if (!cardName.trim()) return "Completează numele de pe card.";

    const digits = cardNumber.replace(/\s+/g, "");
    if (!/^\d{16}$/.test(digits)) return "Numărul cardului trebuie să aibă exact 16 cifre.";

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) {
      return "Expirarea trebuie să fie în format MM/YY (ex: 07/29).";
    }

    const [mmStr, yyStr] = exp.split("/");
    const mm = Number(mmStr);
    const yy = Number(yyStr);
    const now = new Date();
    const curYY = now.getFullYear() % 100;
    const curMM = now.getMonth() + 1;

    if (yy < curYY || (yy === curYY && mm < curMM)) {
      return "Card expirat. Pune o dată de expirare validă (în viitor).";
    }

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
      event_id: Number(eventId),
      customer_name: `${firstName.trim()} ${lastName.trim()}`,
      customer_email: email.trim(),
      quantity: Number(qty),
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

    setEvent((prev) =>
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
    
  } catch (err) {
    setSuccess("");
    setError(String(err.message || err));
  } finally {
    setIsSubmitting(false);
  }
};

const handleCancelTicket = async () => {
  if (!lastTicketId || !window.confirm("Sigur vrei să anulezi acest bilet? Poți face undo mai târziu.")) {
    return;
  }
  
  try {
    const response = await fetch(`${API}/tickets/cancel/${lastTicketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    if (response.ok) {
     
      const res = await fetch(`${API}/events/`);
      const data = await res.json();
      const found = (data || []).find((e) => String(e.id) === String(eventId));
      setEvent(found || null);
      
      setLastTicketId(null);
      setIsTicketPurchased(false);
      setSuccess("");
      alert("✅ Bilet anulat cu succes! Folosește ↩️ în CinemaHome pentru undo.");
    } else {
      const error = await response.json();
      alert(`❌ Eroare: ${error.detail}`);
    }
  } catch (err) {
    alert("❌ Eroare de conexiune la server");
  }
};

  // =========================
  // Styles
  // =========================
  const page = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% 0%, #fff 0%, #ffe4f0 40%, #ffd1e6 100%)",
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

  const sectionTitle = {
    color: "#d63384",
    marginTop: 0,
    marginBottom: "12px",
    fontSize: "18px",
  };

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

  const alert = (type) => ({
    background: "white",
    padding: "10px 12px",
    borderRadius: "14px",
    border:
      type === "error" ? "1px solid rgba(220,0,0,0.25)" : "1px solid rgba(0,140,0,0.25)",
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

  const layout = {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: "18px",
  };

  // =========================
  // /buy: SELECT MOVIE SCREEN
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
            <h2 style={{ margin: 0, color: "#d63384" }}>Alege filmul</h2>
            <div style={{ marginTop: "6px", fontWeight: 800, color: "#6b0040" }}>
              Cinema selectat: <span style={{ color: "#b4005d" }}>{location}</span>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={label}>Film</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ ...input, cursor: "pointer" }}
                required
              >
                {allEvents.length === 0 ? (
                  <option value="">Nu există filme disponibile</option>
                ) : (
                  allEvents.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.title} {e.genre ? `• ${e.genre}` : ""} • {e.price} lei
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={pillRow}>
              <span style={pill}>📍 {location}</span>
              <span style={pill}>🎬 Filme: {allEvents.length}</span>
            </div>

            <button
              style={{ ...primaryBtn, marginTop: "16px", opacity: allEvents.length ? 1 : 0.6 }}
              disabled={!allEvents.length || !selectedEventId}
              onClick={() => navigate(`/buy/${selectedEventId}`)}
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
  // /buy/:eventId CHECKOUT
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
            Cumpără bilet {event ? `— ${event.title}` : ""}
          </h2>

          <div style={pillRow}>
            <span style={pill}>📍 {event?.location || "..."}</span>
            <span style={pill}>💰 {event ? `${event.price} lei / bilet` : "..."}</span>
            <span style={pill}>🎟️ Disponibile: {event?.available_tickets ?? "..."}</span>
            {event?.genre ? <span style={pill}>🏷️ {event.genre}</span> : null}
          </div>
        </div>

        <div style={layout}>
          {/* LEFT: form */}
          <div style={card}>
            <form onSubmit={handleSubmit}>
              <h3 style={sectionTitle}>Date cumpărător</h3>

              {/* Nume */}
              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Nume</label>
                <input
                  style={input}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>

              {/* Prenume (sub nume) */}
              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Prenume</label>
                <input
                  style={input}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Email</label>
                <input
                  style={input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                />
              </div>

              {/* Qty */}
              <div style={{ marginBottom: "6px", maxWidth: "220px" }}>
                <label style={label}>Cantitate</label>
                <input
                  style={input}
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  required
                />
              </div>

              <div style={hr} />

              <h3 style={sectionTitle}>Plată (fictivă)</h3>

              <div style={{ marginBottom: "12px" }}>
                <label style={label}>Nume pe card</label>
                <input
                  style={input}
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  required
                />
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

              {error ? <div style={alert("error")}>{error}</div> : null}
              {success ? <div style={alert("success")}>{success}</div> : null}

              {isTicketPurchased && lastTicketId && (
  <div style={{ 
    marginTop: "12px",
    marginBottom: "12px",
    padding: "12px",
    background: "#fff5f5",
    borderRadius: "14px",
    border: "1px solid #ffb3d1",
    textAlign: "center"
  }}>
    <div style={{ 
      fontSize: "14px", 
      color: "#d63384", 
      marginBottom: "8px",
      fontWeight: "bold" 
    }}>
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
        width: "100%"
      }}
    >
      ❌ Anulează acest bilet
    </button>
    <div style={{ 
      fontSize: "11px", 
      color: "#666", 
      marginTop: "6px",
      fontStyle: "italic" 
    }}>
      Poți anula biletul în maxim 24 de ore. Folosește butonul ↩️ în pagina principală pentru undo.
    </div>
  </div>
)}

              <button type="submit" style={{ ...primaryBtn, opacity: isSubmitting ? 0.7 : 1 }} disabled={isSubmitting}>
                {isSubmitting ? "Se procesează..." : "Plătește și cumpără"}
              </button>

              <button type="button" style={ghostBtn} onClick={() => navigate("/buy")}>
                Schimbă filmul
              </button>

              <div style={{ marginTop: "10px", fontSize: "12px", opacity: 0.8, lineHeight: 1.4 }}>
                * Plata este fictivă (nu se procesează bani reali), dar validăm formatul datelor pentru realism.
              </div>
            </form>
          </div>

          {/* RIGHT: summary */}
          <div style={card}>
            <h3 style={sectionTitle}>Rezumat comandă</h3>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ fontWeight: "bold" }}>{event?.title || "Eveniment"}</div>
              <div style={{ color: "#6b0040", fontWeight: 900 }}>{event ? `${event.price} lei` : "-"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <div style={{ opacity: 0.85 }}>Cantitate</div>
              <div style={{ fontWeight: "bold" }}>{qty}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <div style={{ opacity: 0.85 }}>Subtotal</div>
              <div style={{ fontWeight: "bold" }}>{total} lei</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <div style={{ opacity: 0.85 }}>Taxe</div>
              <div style={{ fontWeight: "bold" }}>0 lei</div>
            </div>

            <div style={hr} />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <div style={{ fontSize: "16px", fontWeight: "bold" }}>Total</div>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#d63384" }}>
                {total} lei
              </div>
            </div>

            <div style={{ marginTop: "14px", fontSize: "12px", opacity: 0.85, lineHeight: 1.5 }}>
              ✅ Confirmarea se face instant după trimiterea formularului. <br />
              ✅ Biletele disponibile se reduc în baza de date. <br />
              ℹ️ Dacă primești eroare, verifică dacă backend-ul rulează pe <b>127.0.0.1:8000</b>.
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
