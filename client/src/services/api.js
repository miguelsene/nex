import { SERVER_HTTP_URL } from "./socket.js";

async function request(path, options) {
  const res = await fetch(`${SERVER_HTTP_URL}${path}`, options);
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
