import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Alerts from "./pages/Alerts";
import Predictions from "./pages/Predictions";
import Layout from "./components/Layout";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="predictions" element={<Predictions />} />
            </Route>
          </Routes>
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;