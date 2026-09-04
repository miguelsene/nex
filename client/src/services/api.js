import { SERVER_HTTP_URL } from "./socket.js";

async function request(path, options) {
  // Use rota relativa quando o backend estiver no mesmo host/origem
  let base = (SERVER_HTTP_URL || "").replace(/\/$/, "");
  try {
    const url = new URL(base || window.location.href);
    if (url.host === window.location.host) base = "";
  } catch {
    base = base || "";
  }

  const res = await fetch(`${base}${path}`, options);
  if (!res.ok) {
    throw new Error(`Falha na requisição: ${path}`);
  }
  return res.json();
}

export function createRoom() {
  return request("/api/rooms", { method: "POST" });
}

export function checkRoomExists(roomId) {
  return request(`/api/rooms/${encodeURIComponent(roomId)}`);
}

export function fetchIceConfig() {
  return request("/api/ice-config");
}

// Acorda serviços que entram em repouso (por exemplo, hospedagens gratuitas)
// enquanto a pessoa ainda está na tela inicial, sem bloquear a interface.
export function warmUpServer() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  return fetch(`${SERVER_HTTP_URL}/api/health`, { signal: controller.signal })
    .catch(() => null)
    .finally(() => window.clearTimeout(timeout));
}
