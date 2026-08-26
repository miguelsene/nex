import { Router } from "express";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { requireAuth } from "./authRoutes.js";

const router = Router();

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getServer(id) {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(id);
  if (!server) return null;
  const members = db.prepare("SELECT * FROM server_members WHERE server_id = ?").all(id);
  const channels = db.prepare("SELECT * FROM channels WHERE server_id = ? ORDER BY rowid").all(id);
  const owner = members.find((m) => m.user_id === server.owner_id);
  return {
    id: server.id,
    name: server.name,
    icon: server.icon,
    ownerId: server.owner_id,
    ownerName: owner?.user_name || "",
    inviteCode: server.invite_code,
    createdAt: server.created_at,
    members: members.map((m) => ({ id: m.user_id, name: m.user_name, avatar: m.user_avatar, role: m.role, joinedAt: m.joined_at })),
    channels: channels.map((c) => ({ id: c.id, type: c.type, name: c.name })),
  };
}

// Listar servidores do usuário
router.get("/", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.id FROM servers s
    INNER JOIN server_members sm ON sm.server_id = s.id
    WHERE sm.user_id = ?
  `).all(req.userId);
  const servers = rows.map((r) => getServer(r.id)).filter(Boolean);
  res.json({ ok: true, servers });
});

// Criar servidor
router.post("/", requireAuth, (req, res) => {
  const { name, iconDataUrl } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Nome obrigatório." });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ ok: false, error: "Usuário não encontrado." });

  let inviteCode = generateInviteCode();
  while (db.prepare("SELECT id FROM servers WHERE invite_code = ?").get(inviteCode)) {
    inviteCode = generateInviteCode();
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO servers (id, name, icon, owner_id, invite_code, created_at) VALUES (?,?,?,?,?,?)")
    .run(id, name.trim().slice(0, 40), iconDataUrl || null, req.userId, inviteCode, now);

  db.prepare("INSERT INTO server_members (server_id, user_id, user_name, user_avatar, role, joined_at) VALUES (?,?,?,?,?,?)")
    .run(id, req.userId, user.name, user.avatar, "owner", now);

  // Canais padrão
  db.prepare("INSERT INTO channels (id, server_id, type, name) VALUES (?,?,?,?)")
    .run(randomUUID(), id, "text", "geral");
  db.prepare("INSERT INTO channels (id, server_id, type, name) VALUES (?,?,?,?)")
    .run(randomUUID(), id, "text", "off-topic");
  db.prepare("INSERT INTO channels (id, server_id, type, name) VALUES (?,?,?,?)")
    .run(randomUUID(), id, "voice", "Voz Geral");

  res.json({ ok: true, server: getServer(id) });
});

// Entrar por código
router.post("/join", requireAuth, (req, res) => {
  const { inviteCode } = req.body || {};
  if (!inviteCode) return res.status(400).json({ ok: false, error: "Código obrigatório." });

  const server = db.prepare("SELECT * FROM servers WHERE invite_code = ?").get(inviteCode.toUpperCase().trim());
  if (!server) return res.status(404).json({ ok: false, error: "Código de convite inválido." });

  const already = db.prepare("SELECT * FROM server_members WHERE server_id = ? AND user_id = ?").get(server.id, req.userId);
  if (already) return res.status(409).json({ ok: false, error: "Você já é membro deste servidor." });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  db.prepare("INSERT INTO server_members (server_id, user_id, user_name, user_avatar, role, joined_at) VALUES (?,?,?,?,?,?)")
    .run(server.id, req.userId, user.name, user.avatar, "member", Date.now());

  res.json({ ok: true, server: getServer(server.id) });
});

// Sair / deletar servidor
router.delete("/:id/leave", requireAuth, (req, res) => {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: "Servidor não encontrado." });

  if (server.owner_id === req.userId) {
    db.prepare("DELETE FROM servers WHERE id = ?").run(req.params.id);
  } else {
    db.prepare("DELETE FROM server_members WHERE server_id = ? AND user_id = ?").run(req.params.id, req.userId);
  }
  res.json({ ok: true });
});

// Editar servidor (nome, ícone)
router.patch("/:id", requireAuth, (req, res) => {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: "Servidor não encontrado." });
  if (server.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Sem permissão." });

  const { name, iconDataUrl } = req.body || {};
  const newName = name ? name.trim().slice(0, 40) : server.name;
  const newIcon = iconDataUrl !== undefined ? (iconDataUrl || null) : server.icon;
  db.prepare("UPDATE servers SET name = ?, icon = ? WHERE id = ?").run(newName, newIcon, req.params.id);

  res.json({ ok: true, server: getServer(req.params.id) });
});

// Regenerar código de convite
router.post("/:id/regen-invite", requireAuth, (req, res) => {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: "Servidor não encontrado." });
  if (server.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Sem permissão." });

  let code = generateInviteCode();
  while (db.prepare("SELECT id FROM servers WHERE invite_code = ?").get(code)) code = generateInviteCode();
  db.prepare("UPDATE servers SET invite_code = ? WHERE id = ?").run(code, req.params.id);

  res.json({ ok: true, inviteCode: code });
});

// Adicionar canal
router.post("/:id/channels", requireAuth, (req, res) => {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: "Servidor não encontrado." });
  if (server.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Sem permissão." });

  const { name, type = "text" } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Nome obrigatório." });
  if (!["text", "voice"].includes(type)) return res.status(400).json({ ok: false, error: "Tipo inválido." });

  const id = randomUUID();
  db.prepare("INSERT INTO channels (id, server_id, type, name) VALUES (?,?,?,?)")
    .run(id, req.params.id, type, name.trim().slice(0, 30));

  res.json({ ok: true, channel: { id, type, name: name.trim().slice(0, 30) } });
});

// Deletar canal
router.delete("/:id/channels/:channelId", requireAuth, (req, res) => {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(req.params.id);
  if (!server) return res.status(404).json({ ok: false, error: "Servidor não encontrado." });
  if (server.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Sem permissão." });

  db.prepare("DELETE FROM channels WHERE id = ? AND server_id = ?").run(req.params.channelId, req.params.id);
  res.json({ ok: true });
});

// Mensagens de canal
router.get("/:id/channels/:channelId/messages", requireAuth, (req, res) => {
  const member = db.prepare("SELECT * FROM server_members WHERE server_id = ? AND user_id = ?")
    .get(req.params.id, req.userId);
  if (!member) return res.status(403).json({ ok: false, error: "Sem acesso." });

  const msgs = db.prepare("SELECT * FROM server_messages WHERE channel_id = ? ORDER BY at ASC LIMIT 200")
    .all(req.params.channelId);
  res.json({ ok: true, messages: msgs.map((m) => ({ id: m.id, fromId: m.from_id, fromName: m.from_name, fromAvatar: m.from_avatar, text: m.text, at: m.at })) });
});

// Enviar mensagem
router.post("/:id/channels/:channelId/messages", requireAuth, (req, res) => {
  const member = db.prepare("SELECT * FROM server_members WHERE server_id = ? AND user_id = ?")
    .get(req.params.id, req.userId);
  if (!member) return res.status(403).json({ ok: false, error: "Sem acesso." });

  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ ok: false, error: "Mensagem vazia." });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  const msg = { id: randomUUID(), from_id: req.userId, from_name: user.name, from_avatar: user.avatar, text: text.trim().slice(0, 500), at: Date.now() };
  db.prepare("INSERT INTO server_messages (id, channel_id, from_id, from_name, from_avatar, text, at) VALUES (?,?,?,?,?,?,?)")
    .run(msg.id, req.params.channelId, msg.from_id, msg.from_name, msg.from_avatar, msg.text, msg.at);

  res.json({ ok: true, message: { id: msg.id, fromId: msg.from_id, fromName: msg.from_name, fromAvatar: msg.from_avatar, text: msg.text, at: msg.at } });
});

export default router;
