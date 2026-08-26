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
  const id = randomUUID();
  let friendId = generateFriendId();
  while (db.prepare("SELECT id FROM users WHERE friend_id = ?").get(friendId)) {
    friendId = generateFriendId();
  }

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
