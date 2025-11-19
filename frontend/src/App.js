import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import CinemaHome from "./CinemaHome.js";
import SelectLocation from "./SelectLocation.js";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CinemaHome />} />
        <Route path="/select-location" element={<SelectLocation />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
