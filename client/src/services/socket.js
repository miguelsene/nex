import { io } from "socket.io-client";

const getDefaultServerUrl = () => {
  const host = window.location.hostname || "localhost";
  const normalizedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  return `${protocol}://${normalizedHost}:4000`;
};

const isStaleServerOverride = (value) => {
  if (!value) return false;

  try {
    const url = new URL(value);
    return ["26.152.95.202", "0.0.0.0", "localhost"].includes(url.hostname) === false && value.includes("26.152.95.202");
  } catch {
    return false;
  }
};

const envServerUrl = import.meta.env.VITE_SERVER_URL?.trim();
const SERVER_URL = (envServerUrl && !isStaleServerOverride(envServerUrl) ? envServerUrl : getDefaultServerUrl()).trim();

let socket = null;

/**
 * Retorna a instância singleton do socket, criando-a (sem conectar
 * automaticamente) na primeira chamada.
 */
export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}

export const SERVER_HTTP_URL = SERVER_URL;
