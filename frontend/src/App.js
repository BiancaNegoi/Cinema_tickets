import React, { useEffect, useState } from 'react';

function App() {
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedCinema, setSelectedCinema] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/movies")
      .then(res => res.json())
      .then(data => setMovies(data));

    fetch("http://127.0.0.1:8000/cinemas")
      .then(res => res.json())
      .then(data => setCinemas(data));
  }, []);

  const buyTicket = () => {
    fetch(`http://127.0.0.1:8000/buy_ticket?movie_id=${selectedMovie}&cinema_id=${selectedCinema}`, {
      method: "POST",
    })
    .then(res => res.json())
    .then(data => alert(data.message));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Aplicație bilete cinema</h1>

      <h2>Selectează film</h2>
      <select onChange={e => setSelectedMovie(e.target.value)}>
        <option>Alege un film...</option>
        {movies.map(m => (
          <option key={m.id} value={m.id}>{m.title}</option>
        ))}
      </select>

      <h2>Selectează cinema</h2>
      <select onChange={e => setSelectedCinema(e.target.value)}>
        <option>Alege un cinema...</option>
        {cinemas.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <button onClick={buyTicket}>Cumpără bilet</button>
    </div>
  );
}

export default App;
