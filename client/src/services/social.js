/**
 * Histórico de ligações, contatos e mensagens diretas — tudo em localStorage.
 */

const HISTORY_KEY = "nexa_call_history";
const CONTACTS_KEY = "nexa_contacts";
const DM_KEY = "nexa_dms";

// --- Histórico de ligações ---

export function getCallHistory(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    return (all[userId] || []).slice(0, 50);
  } catch { return []; }
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
