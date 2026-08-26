import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/index.css";
import { THEMES } from "./hooks/useTheme.js";
import { warmUpServer } from "./services/api.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

warmUpServer();

// Guarda o evento mesmo enquanto a abertura ainda está sendo exibida.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.nexInstallPrompt = event;
});

// Aplica tema salvo antes do primeiro render para evitar flash
(function () {
  const id = localStorage.getItem("nexa_theme");
  if (id) {
    const theme = THEMES.find((t) => t.id === id);
    if (theme) Object.entries(theme.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
