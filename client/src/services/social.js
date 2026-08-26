/**
 * Histórico de ligações, contatos, mensagens diretas e pedidos de amizade.
 */

const HISTORY_KEY = "nexa_call_history";
const CONTACTS_KEY = "nexa_contacts";
const DM_KEY = "nexa_dms";
const FRIEND_REQUESTS_KEY = "nexa_friend_requests";

// --- Histórico de ligações ---

export function getCallHistory(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    return (all[userId] || []).slice(0, 50);
  } catch { return []; }
}

export function removeCallRecord(userId, recordId) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    all[userId] = (all[userId] || []).filter((r) => r.id !== recordId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {}
}

export function clearCallHistory(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    all[userId] = [];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {}
}

export function saveCallRecord(userId, { roomId, participants, durationSeconds }) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    const list = all[userId] || [];
    list.unshift({ id: crypto.randomUUID(), roomId, participants, durationSeconds, at: Date.now() });
    all[userId] = list.slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {}
}

// --- Contatos ---

export function getContacts(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(CONTACTS_KEY) || "{}");
    return all[userId] || [];
  } catch { return []; }
}

export function addContact(userId, contact) {
  try {
    const all = JSON.parse(localStorage.getItem(CONTACTS_KEY) || "{}");
    const list = all[userId] || [];
    if (list.find((c) => c.id === contact.id)) return;
    list.push({ id: contact.id, name: contact.name, avatar: contact.avatar || null, addedAt: Date.now() });
    all[userId] = list;
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(all));
  } catch {}
}

export function removeContact(userId, contactId) {
  try {
    const all = JSON.parse(localStorage.getItem(CONTACTS_KEY) || "{}");
    all[userId] = (all[userId] || []).filter((c) => c.id !== contactId);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(all));
  } catch {}
}

// --- Mensagens diretas ---

function dmKey(a, b) {
  return [a, b].sort().join("__");
}

export function getDMs(userIdA, userIdB) {
  try {
    const all = JSON.parse(localStorage.getItem(DM_KEY) || "{}");
    return all[dmKey(userIdA, userIdB)] || [];
  } catch { return []; }
}

export function sendDM(fromId, fromName, toId, text) {
  try {
    const all = JSON.parse(localStorage.getItem(DM_KEY) || "{}");
    const key = dmKey(fromId, toId);
    const list = all[key] || [];
    list.push({ id: crypto.randomUUID(), fromId, fromName, text: text.trim(), at: Date.now() });
    all[key] = list.slice(-200);
    localStorage.setItem(DM_KEY, JSON.stringify(all));
    return list[list.length - 1];
  } catch { return null; }
}

// --- Pedidos de amizade ---

export function getFriendRequests(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(FRIEND_REQUESTS_KEY) || "{}");
    return all[userId] || [];
  } catch { return []; }
}

export function sendFriendRequest(fromUser, toUserId) {
  try {
    const all = JSON.parse(localStorage.getItem(FRIEND_REQUESTS_KEY) || "{}");
    const list = all[toUserId] || [];
    if (list.find((r) => r.fromId === fromUser.id)) return { ok: false, error: "Pedido já enviado." };
    list.push({ id: crypto.randomUUID(), fromId: fromUser.id, fromName: fromUser.name, fromAvatar: fromUser.avatar || null, at: Date.now(), status: "pending" });
    all[toUserId] = list;
    localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(all));
    return { ok: true };
  } catch { return { ok: false, error: "Erro ao enviar pedido." }; }
}

export function acceptFriendRequest(userId, requestId, myInfo) {
  try {
    const all = JSON.parse(localStorage.getItem(FRIEND_REQUESTS_KEY) || "{}");
    const list = all[userId] || [];
    const req = list.find((r) => r.id === requestId);
    if (!req) return;
    req.status = "accepted";
    all[userId] = list;
    localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(all));
    // Adiciona como contato nos dois lados
    addContact(userId, { id: req.fromId, name: req.fromName, avatar: req.fromAvatar });
    addContact(req.fromId, { id: myInfo.id, name: myInfo.name, avatar: myInfo.avatar || null });
  } catch {}
}

export function declineFriendRequest(userId, requestId) {
  try {
    const all = JSON.parse(localStorage.getItem(FRIEND_REQUESTS_KEY) || "{}");
    all[userId] = (all[userId] || []).filter((r) => r.id !== requestId);
    localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(all));
  } catch {}
}

export function getPendingRequestsCount(userId) {
  return getFriendRequests(userId).filter((r) => r.status === "pending").length;
}
