import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/index.css";
import { THEMES } from "./hooks/useTheme.js";
import { warmUpServer } from "./services/api.js";

const isLocalDevHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);

if ("serviceWorker" in navigator && !isLocalDevHost) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "activated" && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    } catch {
      // Ignora falha do service worker em navegadores restritivos.
    }
  });
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
