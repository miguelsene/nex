import { roomManager } from "../rooms/roomManager.js";

const MAX_CHAT_MESSAGE_LENGTH = 1000;
const musicStates = new Map();

/**
 * Registra todos os eventos de sinalização para uma conexão Socket.IO.
 * O servidor NUNCA guarda mídia (áudio/vídeo) — apenas repassa mensagens
 * de sinalização (offer/answer/ICE) entre os pares e mantém o estado
 * mínimo da sala (nome, mic/cam ligados) em memória.
 */
export function registerSocketHandlers(io, socket) {
  // Sala em que este socket está atualmente (um socket = uma sala por vez)
  let currentRoomId = null;

  socket.on("join-room", ({ roomId, name, avatar, userId }, callback) => {
    try {
      if (!roomManager.isValidRoomId(roomId)) {
        return callback?.({ ok: false, error: "ID de sala inválido." });
      }

      const result = roomManager.addParticipant(roomId, socket.id, name, avatar, userId);
      if (!result) {
        return callback?.({ ok: false, error: "Não foi possível entrar na sala." });
      }

      const { participant } = result;
      currentRoomId = roomId;
      socket.join(roomId);

      const existingParticipants = roomManager
        .listParticipants(roomId)
        .filter((p) => p.id !== socket.id);

      // Confirma para quem entrou, enviando a lista de quem já está na sala
      callback?.({
        ok: true,
        roomId,
        self: participant,
        participants: existingParticipants,
      });

      // Avisa os demais participantes
      socket.to(roomId).emit("user-joined", { participant });
    } catch (err) {
      callback?.({ ok: false, error: "Erro inesperado ao entrar na sala." });
    }
  });

  // --- Sinalização WebRTC (repasse direto entre pares, ponto a ponto) ---
  socket.on("offer", ({ to, offer }) => {
    if (!to || !offer) return;
    // Suporta canal opcional (ex: 'screen') enviado pelo cliente
    const channel = typeof arguments[0] === 'object' && arguments[0]?.channel ? arguments[0].channel : null;
    const fromId = channel ? `${socket.id}#${channel}` : socket.id;
    io.to(to).emit("offer", { from: fromId, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    if (!to || !answer) return;
    const channel = typeof arguments[0] === 'object' && arguments[0]?.channel ? arguments[0].channel : null;
    const fromId = channel ? `${socket.id}#${channel}` : socket.id;
    io.to(to).emit("answer", { from: fromId, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    if (!to || !candidate) return;
    const channel = typeof arguments[0] === 'object' && arguments[0]?.channel ? arguments[0].channel : null;
    const fromId = channel ? `${socket.id}#${channel}` : socket.id;
    io.to(to).emit("ice-candidate", { from: fromId, candidate });
  });

  // --- Estado do participante ---
  socket.on("toggle-audio", ({ micOn }) => {
    if (!currentRoomId) return;
    roomManager.updateParticipant(currentRoomId, socket.id, { micOn: !!micOn });
    socket.to(currentRoomId).emit("toggle-audio", { id: socket.id, micOn: !!micOn });
  });

  socket.on("toggle-video", ({ camOn }) => {
    if (!currentRoomId) return;
    roomManager.updateParticipant(currentRoomId, socket.id, { camOn: !!camOn });
    socket.to(currentRoomId).emit("toggle-video", { id: socket.id, camOn: !!camOn });
  });

  socket.on("screen-share-started", () => {
    if (!currentRoomId) return;
    // Marca como compartilhando e adiciona um participante sintético que representa a tela
    roomManager.updateParticipant(currentRoomId, socket.id, { isSharingScreen: true });

    const existing = roomManager.listParticipants(currentRoomId).find((p) => p.id === socket.id);
    const syntheticId = `${socket.id}#screen`;
    // Evita duplicar caso já exista
    if (!roomManager.listParticipants(currentRoomId).some((p) => p.id === syntheticId)) {
      const participantMeta = existing || { name: "Convidado", avatar: null, userId: null };
      const result = roomManager.addParticipant(currentRoomId, syntheticId, `${participantMeta.name} (Tela)`, participantMeta.avatar, participantMeta.userId);
      if (result) {
        socket.to(currentRoomId).emit("user-joined", { participant: result.participant });
      }
    }
    socket.to(currentRoomId).emit("screen-share-started", { id: socket.id });
  });

  socket.on("screen-share-stopped", () => {
    if (!currentRoomId) return;
    roomManager.updateParticipant(currentRoomId, socket.id, { isSharingScreen: false });
    const syntheticId = `${socket.id}#screen`;
    roomManager.removeParticipant(currentRoomId, syntheticId);
    socket.to(currentRoomId).emit("user-left", { id: syntheticId });
    socket.to(currentRoomId).emit("screen-share-stopped", { id: socket.id });
  });

  socket.on("speaking", ({ isSpeaking }) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit("speaking", { id: socket.id, isSpeaking: !!isSpeaking });
  });

  // --- Música compartilhada (YouTube) ---
  socket.on("music-update", (data = {}) => {
    if (!currentRoomId) return;
    const previous = musicStates.get(currentRoomId) || {};
    const currentTime = data.action === "load" ? 0 : Number.isFinite(Number(data.currentTime)) ? Math.max(0, Number(data.currentTime)) : previous.currentTime || 0;
    const next = {
      videoId: typeof data.videoId === "string" ? data.videoId.slice(0, 32) : previous.videoId,
      currentTime,
      loop: data.loop === undefined ? previous.loop : !!data.loop,
      volume: data.volume === undefined ? previous.volume : Math.min(100, Math.max(0, Number(data.volume) || 0)),
      playing: data.action === "play" ? true : data.action === "pause" || data.action === "load" ? false : !!previous.playing,
      updatedAt: Date.now(),
    };
    musicStates.set(currentRoomId, next);
    // Repassa para todos os outros na sala
    socket.to(currentRoomId).emit("music-update", { ...data, ...next, action: data.action });
  });

  socket.on("get-music-state", () => {
    if (!currentRoomId) return;
    const state = musicStates.get(currentRoomId);
    if (!state?.videoId) return;
    const elapsed = state.playing ? (Date.now() - state.updatedAt) / 1000 : 0;
    socket.emit("music-update", { ...state, currentTime: state.currentTime + elapsed, action: state.playing ? "play" : "pause" });
  });

  // --- Chat (somente em memória, dura enquanto a sala existir) ---
  socket.on("chat-message", ({ text }) => {
    if (!currentRoomId || typeof text !== "string") return;
    const trimmed = text.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!trimmed) return;

    const participant = roomManager
      .listParticipants(currentRoomId)
      .find((p) => p.id === socket.id);

    const message = {
      id: `${socket.id}-${Date.now()}`,
      senderId: socket.id,
      name: participant?.name || "Convidado",
      text: trimmed,
      timestamp: Date.now(),
    };

    io.to(currentRoomId).emit("chat-message", message);
  });

  // --- Saída explícita da chamada ---
  socket.on("leave-room", () => {
    handleLeave();
  });

  socket.on("disconnect", () => {
    handleLeave();
  });

  function handleLeave() {
    if (!currentRoomId) return;
    const roomId = currentRoomId;
    currentRoomId = null;

    roomManager.removeParticipant(roomId, socket.id);
    if (roomManager.listParticipants(roomId).length === 0) musicStates.delete(roomId);
    socket.to(roomId).emit("user-left", { id: socket.id });
    socket.leave(roomId);
  }
}
