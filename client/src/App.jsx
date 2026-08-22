import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Room from "./pages/Room.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<Room />} />
      <Route
        path="*"
        element={
          <div className="not-found">
            <h1>404</h1>
            <p>Esta página não existe.</p>
            <a href="/" className="btn btn-primary">
              Voltar para o início
            </a>
          </div>
        }
      />
    </Routes>
  );
}
