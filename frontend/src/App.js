import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import CinemaHome from "./CinemaHome.js";
import SelectLocation from "./SelectLocation.js";
import BuyTicket from "./BuyTicket.js";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CinemaHome />} />
        <Route path="/select-location" element={<SelectLocation />} />
        <Route path="/buy/:eventId" element={<BuyTicket />} />
        <Route path="/buy" element={<BuyTicket />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
