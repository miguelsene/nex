import { SERVER_HTTP_URL } from "./socket.js";

const SESSION_KEY = "nexa_session";
const TOKEN_KEY = "nexa_token";

export function getSession() {
  // Um perfil salvo sem JWT não pode acessar rotas protegidas.
  if (!getToken()) return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

function saveSession(user, token) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

async function api(path, body, method = "POST") {
  const token = getToken();
  const res = await fetch(`${SERVER_HTTP_URL}/api/auth${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function register({ name, email, password, avatarDataUrl }) {
  const data = await api("/register", { name, email, password, avatarDataUrl });
  if (data.ok) saveSession(data.user, data.token);
  return data;
}

export async function login({ email, password }) {
  const data = await api("/login", { email, password });
  if (data.ok) saveSession(data.user, data.token);
  return data;
}

export async function updateProfile({ name, avatarDataUrl }) {
  const data = await api("/update", { name, avatarDataUrl });
  if (data.ok) saveSession(data.user, null);
  return data;
}

export async function getUserByFriendId(friendId) {
  const data = await api(`/search/${encodeURIComponent(friendId)}`, null, "GET");
  if (!data.ok) return null;
  return data.user;
}

export async function getFriends() {
  const data = await api("/friends", null, "GET");
  return data.friends || [];
}

export async function getIncomingFriendRequests() {
  const data = await api("/friend-requests", null, "GET");
  return data.requests || [];
}

export async function sendFriendRequestById(friendId) {
  return api("/friend-requests", { friendId });
}

export async function acceptIncomingFriendRequest(id) {
  return api(`/friend-requests/${id}/accept`, {}, "POST");
}

export async function declineIncomingFriendRequest(id) {
  return api(`/friend-requests/${id}`, null, "DELETE");
}
