/**
 * Auth simples com localStorage — sem servidor de banco de dados.
 * Senhas são armazenadas com hash SHA-256 (não reversível).
 */

const USERS_KEY = "nexa_users";
const SESSION_KEY = "nexa_session";

async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export async function register({ name, email, password, avatarDataUrl }) {
  const users = getUsers();
  const key = email.toLowerCase().trim();
  if (users[key]) return { ok: false, error: "Este e-mail já está cadastrado." };

  const hash = await hashPassword(password);
  const user = { id: crypto.randomUUID(), name: name.trim(), email: key, hash, avatar: avatarDataUrl || null };
  users[key] = user;
  saveUsers(users);

  const session = { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, user: session };
}

export async function login({ email, password }) {
  const users = getUsers();
  const key = email.toLowerCase().trim();
  const user = users[key];
  if (!user) return { ok: false, error: "E-mail não encontrado." };

  const hash = await hashPassword(password);
  if (hash !== user.hash) return { ok: false, error: "Senha incorreta." };

  const session = { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, user: session };
}

export async function updateProfile({ name, avatarDataUrl }) {
  const session = getSession();
  if (!session) return { ok: false, error: "Não autenticado." };

  const users = getUsers();
  const user = users[session.email];
  if (!user) return { ok: false, error: "Usuário não encontrado." };

  if (name) user.name = name.trim();
  if (avatarDataUrl !== undefined) user.avatar = avatarDataUrl;
  users[session.email] = user;
  saveUsers(users);

  const updated = { ...session, name: user.name, avatar: user.avatar };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return { ok: true, user: updated };
}
