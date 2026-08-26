import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import db from "../db.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "nexa_secret_dev_key";

function generateFriendId() {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
}

function safeUser(row) {
  return { id: row.id, friendId: row.friend_id, name: row.name, email: row.email, avatar: row.avatar || null };
}

router.post("/register", async (req, res) => {
  const { name, email, password, avatarDataUrl } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ ok: false, error: "Campos obrigatórios faltando." });

  const key = email.toLowerCase().trim();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(key))
    return res.status(409).json({ ok: false, error: "Este e-mail já está cadastrado." });

  const hash = await bcrypt.hash(password, 10);
  let friendId = generateFriendId();
  while (db.prepare("SELECT id FROM users WHERE friend_id = ?").get(friendId)) {
    friendId = generateFriendId();
  }
  // O mesmo código público é o ID da conta: somente números e fácil de compartilhar.
  const id = friendId;

  db.prepare("INSERT INTO users (id, friend_id, name, email, hash, avatar) VALUES (?,?,?,?,?,?)")
    .run(id, friendId, name.trim().slice(0, 40), key, hash, avatarDataUrl || null);

  const user = safeUser({ id, friend_id: friendId, name: name.trim(), email: key, avatar: avatarDataUrl || null });
  res.json({ ok: true, user, token: makeToken(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ ok: false, error: "Campos obrigatórios faltando." });

  const key = email.toLowerCase().trim();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(key);
  if (!row) return res.status(401).json({ ok: false, error: "E-mail não encontrado." });

  if (!(await bcrypt.compare(password, row.hash)))
    return res.status(401).json({ ok: false, error: "Senha incorreta." });

  const user = safeUser(row);
  res.json({ ok: true, user, token: makeToken(user) });
});

router.post("/update", requireAuth, async (req, res) => {
  const { name, avatarDataUrl } = req.body || {};
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!row) return res.status(404).json({ ok: false, error: "Usuário não encontrado." });

  const newName = name ? name.trim().slice(0, 40) : row.name;
  const newAvatar = avatarDataUrl !== undefined ? (avatarDataUrl || null) : row.avatar;
  db.prepare("UPDATE users SET name = ?, avatar = ? WHERE id = ?").run(newName, newAvatar, req.userId);

  res.json({ ok: true, user: safeUser({ ...row, name: newName, avatar: newAvatar }) });
});

router.get("/search/:friendId", (req, res) => {
  const row = db.prepare("SELECT id, friend_id, name, avatar FROM users WHERE friend_id = ?")
    .get(String(req.params.friendId).trim());
  if (!row) return res.status(404).json({ ok: false, error: "Usuário não encontrado." });
  res.json({ ok: true, user: { id: row.id, friendId: row.friend_id, name: row.name, avatar: row.avatar || null } });
});

router.get("/friends", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT u.id, u.friend_id, u.name, u.avatar FROM friend_requests f
    JOIN users u ON u.id = CASE WHEN f.from_user_id = ? THEN f.to_user_id ELSE f.from_user_id END
    WHERE (f.from_user_id = ? OR f.to_user_id = ?) AND f.status = 'accepted' ORDER BY u.name`)
    .all(req.userId, req.userId, req.userId);
  res.json({ ok: true, friends: rows.map((row) => ({ id: row.id, friendId: row.friend_id, name: row.name, avatar: row.avatar || null })) });
});

router.get("/friend-requests", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT f.id, f.created_at, u.id AS from_id, u.friend_id, u.name, u.avatar FROM friend_requests f
    JOIN users u ON u.id = f.from_user_id WHERE f.to_user_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`).all(req.userId);
  res.json({ ok: true, requests: rows.map((row) => ({ id: row.id, fromId: row.from_id, fromFriendId: row.friend_id, fromName: row.name, fromAvatar: row.avatar || null, at: row.created_at })) });
});

router.post("/friend-requests", requireAuth, (req, res) => {
  const target = db.prepare("SELECT id FROM users WHERE friend_id = ?").get(String(req.body?.friendId || "").trim());
  if (!target) return res.status(404).json({ ok: false, error: "Usuário não encontrado." });
  if (target.id === req.userId) return res.status(400).json({ ok: false, error: "Você não pode adicionar a si mesmo." });
  const existing = db.prepare("SELECT id, status FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)").get(req.userId, target.id, target.id, req.userId);
  if (existing?.status === "accepted") return res.status(409).json({ ok: false, error: "Este usuário já é seu contato." });
  if (existing) return res.status(409).json({ ok: false, error: "Já existe um pedido entre vocês." });
  db.prepare("INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at) VALUES (?,?,?,?,?)").run(randomUUID(), req.userId, target.id, "pending", Date.now());
  res.json({ ok: true });
});

router.post("/friend-requests/:id/accept", requireAuth, (req, res) => {
  const result = db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ? AND to_user_id = ? AND status = 'pending'").run(req.params.id, req.userId);
  if (!result.changes) return res.status(404).json({ ok: false, error: "Pedido não encontrado." });
  res.json({ ok: true });
});

router.delete("/friend-requests/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'").run(req.params.id, req.userId);
  res.json({ ok: true });
});

function areFriends(userId, contactId) {
  return !!db.prepare("SELECT id FROM friend_requests WHERE status = 'accepted' AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))")
    .get(userId, contactId, contactId, userId);
}

router.get("/direct-messages/:contactId", requireAuth, (req, res) => {
  const contactId = String(req.params.contactId);
  if (!areFriends(req.userId, contactId)) return res.status(403).json({ ok: false, error: "Você só pode conversar com contatos." });
  const messages = db.prepare(`SELECT * FROM direct_messages WHERE
    (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
    ORDER BY created_at ASC LIMIT 300`).all(req.userId, contactId, contactId, req.userId);
  res.json({ ok: true, messages: messages.map((message) => ({ id: message.id, fromId: message.from_user_id, toId: message.to_user_id, text: message.text, at: message.created_at })) });
});

router.post("/direct-messages", requireAuth, (req, res) => {
  const toUserId = String(req.body?.toUserId || "");
  const text = String(req.body?.text || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ ok: false, error: "Mensagem vazia." });
  if (!areFriends(req.userId, toUserId)) return res.status(403).json({ ok: false, error: "Você só pode conversar com contatos." });
  const message = { id: randomUUID(), fromId: req.userId, toId: toUserId, text, at: Date.now() };
  db.prepare("INSERT INTO direct_messages (id, from_user_id, to_user_id, text, created_at) VALUES (?,?,?,?,?)")
    .run(message.id, message.fromId, message.toId, message.text, message.at);
  res.json({ ok: true, message });
});

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ ok: false, error: "Não autenticado." });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch {
    res.status(401).json({ ok: false, error: "Token inválido." });
  }
}

export default router;
