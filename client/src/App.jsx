import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Room from "./pages/Room.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Servers from "./pages/Servers.jsx";
import { AuthProvider } from "./hooks/useAuth.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";

export default function App() {
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const ready = () => window.setTimeout(() => setStarting(false), 450);
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
    return () => window.removeEventListener("load", ready);
  }, []);

  if (starting) return <LoadingScreen />;

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={<div className="not-found"><h1>404</h1><p>Esta página não existe.</p><a href="/" className="btn btn-primary">Voltar para o início</a></div>} />
      </Routes>
    </AuthProvider>
  );
}
