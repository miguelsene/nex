import { SERVER_HTTP_URL } from "./socket.js";
import { getToken } from "./auth.js";

async function api(path, body, method) {
  const token = getToken();
  const res = await fetch(`${SERVER_HTTP_URL}/api/servers${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function getMyServers() {
  const data = await api("/");
  return data.servers || [];
}

export async function createServer(name, iconDataUrl) {
  const data = await api("/", { name, iconDataUrl });
  if (!data.ok) throw new Error(data.error);
  return data.server;
}

export async function joinServer(inviteCode) {
  return api("/join", { inviteCode });
}

export async function leaveServer(serverId) {
  return api(`/${serverId}/leave`, null, "DELETE");
}

export async function editServer(serverId, { name, iconDataUrl }) {
  const data = await api(`/${serverId}`, { name, iconDataUrl }, "PATCH");
  if (!data.ok) throw new Error(data.error);
  return data.server;
}

export async function regenerateInvite(serverId) {
  const data = await api(`/${serverId}/regen-invite`, {});
  if (!data.ok) throw new Error(data.error);
  return data.inviteCode;
}

export async function addChannel(serverId, name, type = "text") {
  const data = await api(`/${serverId}/channels`, { name, type });
  if (!data.ok) throw new Error(data.error);
  return data.channel;
}

export async function deleteChannel(serverId, channelId) {
  return api(`/${serverId}/channels/${channelId}`, null, "DELETE");
}

export async function getServerMessages(serverId, channelId) {
  const data = await api(`/${serverId}/channels/${channelId}/messages`);
  return data.messages || [];
}

export async function sendServerMessage(serverId, channelId, text) {
  const data = await api(`/${serverId}/channels/${channelId}/messages`, { text });
  if (!data.ok) throw new Error(data.error);
  return data.message;
}
