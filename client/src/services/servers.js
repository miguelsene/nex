/**
 * Servidores (comunidades) — tudo em localStorage.
 * Estrutura: { id, name, icon, ownerId, ownerName, inviteCode, members: [], channels: [] }
 */

const SERVERS_KEY = "nexa_servers";
const MEMBERSHIPS_KEY = "nexa_memberships"; // userId -> [serverId]

function getAll() {
  try { return JSON.parse(localStorage.getItem(SERVERS_KEY) || "{}"); } catch { return {}; }
}
function saveAll(data) { localStorage.setItem(SERVERS_KEY, JSON.stringify(data)); }

function getMemberships() {
  try { return JSON.parse(localStorage.getItem(MEMBERSHIPS_KEY) || "{}"); } catch { return {}; }
}
function saveMemberships(data) { localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(data)); }

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function createServer(owner, name, iconDataUrl) {
  const servers = getAll();
  const id = crypto.randomUUID();
  const inviteCode = generateInviteCode();
  const server = {
    id,
    name: name.trim().slice(0, 40),
    icon: iconDataUrl || null,
    ownerId: owner.id,
    ownerName: owner.name,
    inviteCode,
    createdAt: Date.now(),
    members: [{ id: owner.id, name: owner.name, avatar: owner.avatar || null, role: "owner", joinedAt: Date.now() }],
    channels: [
      { id: crypto.randomUUID(), type: "text", name: "geral" },
      { id: crypto.randomUUID(), type: "text", name: "off-topic" },
    ],
    messages: {}, // channelId -> []
  };
  servers[id] = server;
  saveAll(servers);

  // Adiciona membership
  const m = getMemberships();
  m[owner.id] = [...(m[owner.id] || []), id];
  saveMemberships(m);

  return server;
}

export function getMyServers(userId) {
  const m = getMemberships();
  const ids = m[userId] || [];
  const all = getAll();
  return ids.map((id) => all[id]).filter(Boolean);
}

export function getServerByInvite(code) {
  const all = getAll();
  return Object.values(all).find((s) => s.inviteCode === code.toUpperCase().trim()) || null;
}

export function joinServer(user, inviteCode) {
  const all = getAll();
  const server = Object.values(all).find((s) => s.inviteCode === inviteCode.toUpperCase().trim());
  if (!server) return { ok: false, error: "Código de convite inválido." };
  if (server.members.find((m) => m.id === user.id)) return { ok: false, error: "Você já é membro deste servidor." };

  server.members.push({ id: user.id, name: user.name, avatar: user.avatar || null, role: "member", joinedAt: Date.now() });
  all[server.id] = server;
  saveAll(all);

  const m = getMemberships();
  m[user.id] = [...(m[user.id] || []), server.id];
  saveMemberships(m);

  return { ok: true, server };
}

export function leaveServer(userId, serverId) {
  const all = getAll();
  const server = all[serverId];
  if (!server) return;
  if (server.ownerId === userId) {
    // Dono deletar o servidor
    delete all[serverId];
    saveAll(all);
  } else {
    server.members = server.members.filter((m) => m.id !== userId);
    all[serverId] = server;
    saveAll(all);
  }
  const m = getMemberships();
  m[userId] = (m[userId] || []).filter((id) => id !== serverId);
  saveMemberships(m);
}

export function getServerMessages(serverId, channelId) {
  const all = getAll();
  const server = all[serverId];
  if (!server) return [];
  return (server.messages?.[channelId] || []);
}

export function sendServerMessage(serverId, channelId, fromUser, text) {
  const all = getAll();
  const server = all[serverId];
  if (!server) return null;
  if (!server.messages) server.messages = {};
  const list = server.messages[channelId] || [];
  const msg = { id: crypto.randomUUID(), fromId: fromUser.id, fromName: fromUser.name, fromAvatar: fromUser.avatar || null, text: text.trim(), at: Date.now() };
  list.push(msg);
  server.messages[channelId] = list.slice(-200);
  all[serverId] = server;
  saveAll(all);
  return msg;
}

export function addChannel(serverId, ownerId, name, type = "text") {
  const all = getAll();
  const server = all[serverId];
  if (!server || server.ownerId !== ownerId) return null;
  const ch = { id: crypto.randomUUID(), type, name: name.trim().slice(0, 30) };
  server.channels.push(ch);
  all[serverId] = server;
  saveAll(all);
  return ch;
}

export function regenerateInvite(serverId, ownerId) {
  const all = getAll();
  const server = all[serverId];
  if (!server || server.ownerId !== ownerId) return null;
  server.inviteCode = generateInviteCode();
  all[serverId] = server;
  saveAll(all);
  return server.inviteCode;
}
