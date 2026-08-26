import { customAlphabet } from "nanoid";

// Alfabeto sem caracteres ambíguos (0/O, 1/I/l) para códigos de sala mais legíveis
const generateRoomId = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  6
);

/**
 * Estrutura em memória (nada é persistido em disco/banco de dados):
 *
 * rooms = {
 *   [roomId]: {
 *     id: string,
 *     createdAt: number,
 *     participants: Map(socketId -> { id, name, micOn, camOn, isSharingScreen }),
 *     cleanupTimer: Timeout | null
 *   }
 * }
 */
const rooms = new Map();

const ROOM_ID_MAX_ATTEMPTS = 10;
const ROOM_CLEANUP_DELAY_MS = Number(process.env.ROOM_CLEANUP_DELAY_MS || 15000);

function createRoom() {
  let id;
  let attempts = 0;

  do {
    id = generateRoomId();
    attempts += 1;
  } while (rooms.has(id) && attempts < ROOM_ID_MAX_ATTEMPTS);

  const room = {
    id,
    createdAt: Date.now(),
    participants: new Map(),
    cleanupTimer: null,
  };

  rooms.set(id, room);
  return room;
}

function isValidRoomId(id) {
  return typeof id === "string" && /^[A-Z0-9]{4,10}$/.test(id);
}

function getRoom(id) {
  if (!isValidRoomId(id)) return null;
  return rooms.get(id) || null;
}

function ensureRoom(id) {
  if (!isValidRoomId(id)) return null;
  let room = rooms.get(id);
  if (!room) {
    room = {
      id,
      createdAt: Date.now(),
      participants: new Map(),
      cleanupTimer: null,
    };
    rooms.set(id, room);
  }
  return room;
}

function addParticipant(roomId, socketId, name, avatar, userId) {
  const room = ensureRoom(roomId);
  if (!room) return null;

  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }

  const safeName = String(name || "Convidado").trim().slice(0, 40) || "Convidado";
  const safeAvatar = typeof avatar === "string" && avatar.length < 20000 ? avatar : null;
  const safeUserId = typeof userId === "string" && userId.length < 100 ? userId : null;

  const participant = {
    id: socketId,
    name: safeName,
    avatar: safeAvatar,
    userId: safeUserId,
    micOn: true,
    camOn: true,
    isSharingScreen: false,
    joinedAt: Date.now(),
  };

  room.participants.set(socketId, participant);
  return { room, participant };
}

function removeParticipant(roomId, socketId, onEmptyRoom) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.participants.delete(socketId);

  if (room.participants.size === 0) {
    // Aguarda um pequeno intervalo (permite reconexões rápidas) antes de remover a sala da memória
    room.cleanupTimer = setTimeout(() => {
      const stillEmpty = rooms.get(roomId);
      if (stillEmpty && stillEmpty.participants.size === 0) {
        rooms.delete(roomId);
        if (onEmptyRoom) onEmptyRoom(roomId);
      }
    }, ROOM_CLEANUP_DELAY_MS);
  }
}

function updateParticipant(roomId, socketId, patch) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const participant = room.participants.get(socketId);
  if (!participant) return null;
  Object.assign(participant, patch);
  return participant;
}

function listParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.participants.values());
}

function roomExists(roomId) {
  return isValidRoomId(roomId) && rooms.has(roomId);
}

function getStats() {
  return {
    totalRooms: rooms.size,
    totalParticipants: Array.from(rooms.values()).reduce(
      (sum, r) => sum + r.participants.size,
      0
    ),
  };
}

export const roomManager = {
  createRoom,
  getRoom,
  ensureRoom,
  addParticipant,
  removeParticipant,
  updateParticipant,
  listParticipants,
  roomExists,
  isValidRoomId,
  getStats,
};
