import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

import { roomManager } from "./rooms/roomManager.js";
import { registerSocketHandlers } from "./socket/socketHandler.js";
import { getIceServers } from "./signaling/iceConfig.js";
import authRoutes from "./routes/authRoutes.js";
import serverRoutes from "./routes/serverRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client/dist");

const PORT = process.env.PORT || 4000;
const CLIENT_URLS = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim());

const app = express();

const isLocalDevOrigin = (origin) => {
  if (!origin) return true;

  const allowedOrigins = [
    ...CLIENT_URLS,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];

  const lanPattern = /^(http:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\d+\.\d+\.\d+\.\d+):(\d+)$/;
  return allowedOrigins.includes(origin) || lanPattern.test(origin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (process.env.NODE_ENV === "production") {
        callback(null, CLIENT_URLS.includes(origin));
        return;
      }

      callback(null, isLocalDevOrigin(origin));
    },
    credentials: true,
  })
);
app.use(express.json());

// --- Rotas ---

app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...roomManager.getStats() });
});

// Configuração ICE (STUN/TURN) exposta para o cliente montar o RTCPeerConnection
app.get("/api/ice-config", (_req, res) => {
  res.json({ iceServers: getIceServers() });
});

// Cria uma sala nova e devolve o ID gerado
app.post("/api/rooms", (_req, res) => {
  const room = roomManager.createRoom();
  res.json({ roomId: room.id });
});

// Verifica se uma sala existe (usado na tela de "entrar via link")
app.get("/api/rooms/:roomId", (req, res) => {
  const { roomId } = req.params;
  const exists = roomManager.roomExists(roomId.toUpperCase());
  res.json({ exists });
});

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get(/^(?!\/api\/|\/socket\.io).*/, (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/socket.io")) {
      return next();
    }

    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (process.env.NODE_ENV === "production") {
        callback(null, CLIENT_URLS.includes(origin));
        return;
      }

      callback(null, isLocalDevOrigin(origin));
    },
    credentials: true,
  },
  maxHttpBufferSize: 1e6, // 1MB — evita payloads abusivos via socket
});

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor de sinalização rodando em http://localhost:${PORT}`);
  console.log(`Origens de cliente permitidas: ${CLIENT_URLS.join(", ")}`);
  console.log("Escutando em todas as interfaces da rede local");
});
