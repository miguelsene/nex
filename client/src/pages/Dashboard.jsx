import { useEffect, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { parseDice, hasDice } from "../utils/dice.js";

function DiceResult({ text, rollId }) {
  const groups = parseDice(text, rollId);
  if (!groups.length) return null;
  return (
    <div className="dice-result">
      <i className="bi bi-dice-5-fill" style={{ color: "var(--accent-cyan)", fontSize: "0.85rem" }} />
      {groups.map((g, i) => (
        <span key={i} className="dice-group">
          <span className="dice-expr">{g.expr}</span>
          <span className="dice-rolls">[{g.rolls.join(", ")}]{g.mod !== 0 ? ` ${g.mod > 0 ? "+" : ""}${g.mod}` : ""}</span>
          <span className="dice-total">{g.sum}</span>
          {i < groups.length - 1 && <span style={{ color: "var(--text-muted)" }}> · </span>}
        </span>
      ))}
    </div>
  );
}
import {
  getCallHistory, removeContact,
  removeCallRecord, clearCallHistory,
} from "../services/social.js";
import { createRoom } from "../services/api.js";
import { updateProfile, getUserByFriendId, getFriends, getIncomingFriendRequests, sendFriendRequestById, acceptIncomingFriendRequest, declineIncomingFriendRequest, getDirectMessages, sendDirectMessage } from "../services/auth.js";

function formatDuration(s) {
  if (!s) return "0s";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatDate(ts) {
  const d = new Date(ts);
  const diff = Date.now() - d;
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function Avatar({ src, name, size = 40 }) {
  const style = { width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
  if (src) return <img src={src} alt={name} style={style} />;
  return (
    <div style={{ ...style, background: "var(--gradient-aurora)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3, fontWeight: 700, color: "#0a0d16" }}>
      {(name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("history");
  const [history, setHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [dmContact, setDmContact] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmText, setDmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState(null);

  // Editar perfil
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const editFileRef = useRef(null);

  // Buscar por ID
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchMsg, setSearchMsg] = useState(null);

  const messagesEndRef = useRef(null);

  async function reload() {
    if (!user) return;
    setHistory(getCallHistory(user.id));
    try {
      const [remoteContacts, remoteRequests] = await Promise.all([getFriends(), getIncomingFriendRequests()]);
      setContacts(remoteContacts);
      setRequests(remoteRequests);
    } catch {
      // Mantém histórico local utilizável se o servidor estiver temporariamente indisponível.
    }
  }

  useEffect(() => { reload(); }, [user]); // eslint-disable-line

  useEffect(() => {
    if (!dmContact || !user) return undefined;
    let active = true;
    const loadMessages = () => getDirectMessages(dmContact.id).then((messages) => { if (active) setDmMessages(messages); }).catch(() => {});
    loadMessages();
    const timer = window.setInterval(loadMessages, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [dmContact, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  if (!user) return <Navigate to="/auth" replace />;

  const pendingCount = requests.length;

  async function handleNewCall() {
    setLoading(true);
    try {
      const { roomId } = await createRoom();
      navigate(`/room/${roomId}`, { state: { name: user.name } });
    } catch { setLoading(false); }
  }

  function handleJoinByCode(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length < 4) { setJoinError("Código inválido."); return; }
    setJoinError(null);
    navigate(`/room/${code}`, { state: { name: user.name } });
  }

  function handleRemoveContact(id) {
    removeContact(user.id, id);
    setContacts(getContacts(user.id));
    if (dmContact?.id === id) setDmContact(null);
  }

  async function handleSendDM(e) {
    e.preventDefault();
    if (!dmText.trim() || !dmContact) return;
    const text = dmText.trim();
    const result = await sendDirectMessage(dmContact.id, text);
    if (result.ok) {
      setDmMessages((current) => current.some((message) => message.id === result.message.id) ? current : [...current, result.message]);
      setDmText("");
    }
  }

  async function handleAccept(reqId) {
    await acceptIncomingFriendRequest(reqId);
    reload();
  }

  async function handleDecline(reqId) {
    await declineIncomingFriendRequest(reqId);
    reload();
  }

  async function handleSearch(e) {
    e.preventDefault();
    setSearchMsg(null);
    setSearchResult(null);
    const id = searchId.trim();
    if (!id || id.length < 6) { setSearchMsg({ ok: false, text: "Digite um ID válido (9 dígitos)." }); return; }
    const found = await getUserByFriendId(id);
    if (!found) { setSearchMsg({ ok: false, text: "Nenhum usuário encontrado." }); return; }
    if (found.id === user.id) { setSearchMsg({ ok: false, text: "Esse é o seu próprio ID." }); return; }
    setSearchResult(found);
  }

  async function handleSendRequestFromSearch() {
    if (!searchResult) return;
    const result = await sendFriendRequestById(searchResult.friendId);
    if (result.ok) {
      setSearchMsg({ ok: true, text: `Pedido enviado para ${searchResult.name}!` });
      setSearchResult(null);
      setSearchId("");
    } else {
      setSearchMsg({ ok: false, text: result.error });
    }
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 80; canvas.height = 80;
        const ctx = canvas.getContext("2d");
        const size = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 80, 80);
        setEditAvatar(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!editName.trim()) { setEditError("Nome não pode ser vazio."); return; }
    setEditLoading(true);
    const result = await updateProfile({ name: editName, avatarDataUrl: editAvatar !== null ? editAvatar : undefined });
    setEditLoading(false);
    if (!result.ok) { setEditError(result.error); return; }
    updateUser(result.user);
    setEditMode(false);
    setEditAvatar(null);
    setEditError(null);
  }

  return (
    <div className="dashboard">
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob b1" /><div className="aurora-blob b2" />
      </div>

      <header className="dash-header glass-card">
        <button className="btn-ghost-sm" onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="bi bi-arrow-left" /> Início
        </button>

        {/* Entrar por código */}
        <form className="join-code-form" onSubmit={handleJoinByCode} style={{ flex: 1, maxWidth: 260 }}>
          <i className="bi bi-hash" />
          <input
            type="text"
            placeholder="Código da sala"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={10}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
            Entrar
          </button>
        </form>
        {joinError && <span style={{ fontSize: "0.78rem", color: "var(--danger)" }}>{joinError}</span>}

        {/* Perfil clicável */}
        <div
          className="dash-user"
          style={{ cursor: "pointer" }}
          onClick={() => { setEditMode(true); setEditName(user.name); setEditAvatar(null); setEditError(null); }}
          title="Editar perfil"
        >
          <Avatar src={user.avatar} name={user.name} size={32} />
          <span>{user.name}</span>
          <i className="bi bi-pencil-fill" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost-sm" onClick={() => navigate("/servers")} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <i className="bi bi-server" /> Servidores
          </button>
          <button className="btn btn-primary" style={{ padding: "8px 18px", fontSize: "0.85rem" }} onClick={handleNewCall} disabled={loading}>
            <i className="bi bi-plus-circle-fill" /> {loading ? "Criando..." : "Nova sala"}
          </button>
          <button className="btn-ghost-sm" onClick={logout}>Sair</button>
        </div>
      </header>

      {/* Modal editar perfil */}
      {editMode && (
        <div className="modal-overlay" onClick={() => setEditMode(false)}>
          <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar perfil</h3>
              <button className="icon-btn" onClick={() => setEditMode(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div className="avatar-upload-wrap" onClick={() => editFileRef.current?.click()}>
                  {(editAvatar || user.avatar)
                    ? <img src={editAvatar || user.avatar} alt="avatar" className="avatar-upload-preview" />
                    : <div className="avatar-upload-placeholder"><i className="bi bi-camera-fill" /><span>Foto</span></div>
                  }
                </div>
                <input ref={editFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
              </div>
              <div className="name-input-wrap">
                <i className="bi bi-person" />
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} placeholder="Seu nome" />
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>
                Seu ID público: <strong style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>{user.friendId || "—"}</strong>
              </div>
              {editError && <div className="error-text">{editError}</div>}
              <button type="submit" className="btn btn-primary" disabled={editLoading}>
                {editLoading ? "Salvando..." : "Salvar"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="dash-body">
        <div className="dash-left">
          <div className="dash-tabs">
            <button className={tab === "history" ? "dash-tab active" : "dash-tab"} onClick={() => setTab("history")}>
              <i className="bi bi-clock-history" /> Ligações
            </button>
            <button className={tab === "contacts" ? "dash-tab active" : "dash-tab"} onClick={() => setTab("contacts")}>
              <i className="bi bi-people-fill" /> Contatos
              {contacts.length > 0 && <span className="dash-badge">{contacts.length}</span>}
            </button>
            <button className={tab === "requests" ? "dash-tab active" : "dash-tab"} onClick={() => setTab("requests")}>
              <i className="bi bi-person-plus-fill" /> Pedidos
              {pendingCount > 0 && <span className="dash-badge" style={{ background: "var(--danger)" }}>{pendingCount}</span>}
            </button>
          </div>

          {tab === "history" && (
            <div className="dash-list">
              {history.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn-ghost-sm"
                    style={{ fontSize: "0.75rem", color: "var(--danger)", borderColor: "rgba(255,77,109,0.3)" }}
                    onClick={() => { clearCallHistory(user.id); setHistory([]); }}
                  >
                    <i className="bi bi-trash3" /> Limpar tudo
                  </button>
                </div>
              )}
              {history.length === 0 && (
                <div className="dash-empty">
                  <i className="bi bi-camera-video" />
                  <p>Nenhuma ligação ainda.<br />Crie uma sala para começar.</p>
                </div>
              )}
              {history.map((call) => (
                <div className="dash-item glass-card" key={call.id}>
                  <div className="dash-item-icon"><i className="bi bi-camera-video-fill" /></div>
                  <div className="dash-item-info">
                    <span className="dash-item-title">Sala {call.roomId}</span>
                    <span className="dash-item-sub">
                      <i className="bi bi-clock" /> {formatDuration(call.durationSeconds)}
                      {call.participants?.length > 0 && <> · <i className="bi bi-people" /> {call.participants.join(", ")}</>}
                    </span>
                    <span className="dash-item-date">{formatDate(call.at)}</span>
                  </div>
                  <button
                    className="btn-ghost-sm"
                    style={{ fontSize: "0.75rem", padding: "4px 10px", flexShrink: 0 }}
                    onClick={() => navigate(`/room/${call.roomId}`, { state: { name: user.name } })}
                  >
                    <i className="bi bi-box-arrow-in-right" /> Entrar
                  </button>
                  <button
                    className="icon-btn"
                    style={{ flexShrink: 0, color: "var(--danger)" }}
                    onClick={() => { removeCallRecord(user.id, call.id); setHistory(getCallHistory(user.id)); }}
                    title="Remover"
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "contacts" && (
            <div className="dash-list">
              {/* Busca por ID */}
              <form className="dash-search-form" onSubmit={handleSearch}>
                <div className="name-input-wrap" style={{ flex: 1 }}>
                  <i className="bi bi-search" />
                  <input
                    type="text"
                    placeholder="Buscar por ID (ex: 123456789)"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value.replace(/\D/g, ""))}
                    maxLength={9}
                    inputMode="numeric"
                  />
                </div>
                <button type="submit" className="btn-ghost-sm">Buscar</button>
              </form>

              {searchMsg && (
                <div style={{ fontSize: "0.8rem", color: searchMsg.ok ? "var(--success)" : "var(--danger)", padding: "0 4px" }}>
                  {searchMsg.text}
                </div>
              )}

              {searchResult && (
                <div className="dash-item glass-card" style={{ borderColor: "var(--accent-cyan)" }}>
                  <Avatar src={searchResult.avatar} name={searchResult.name} size={40} />
                  <div className="dash-item-info">
                    <span className="dash-item-title">{searchResult.name}</span>
                    <span className="dash-item-sub" style={{ fontFamily: "var(--font-mono)" }}>{searchResult.friendId}</span>
                  </div>
                  <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.78rem", flexShrink: 0 }} onClick={handleSendRequestFromSearch}>
                    <i className="bi bi-person-plus-fill" /> Adicionar
                  </button>
                </div>
              )}

              {contacts.length === 0 && !searchResult && (
                <div className="dash-empty">
                  <i className="bi bi-person-plus" />
                  <p>Nenhum contato ainda.<br />Busque pelo ID ou adicione da ligação.</p>
                </div>
              )}
              {contacts.map((c) => (
                <div
                  className={`dash-item glass-card${dmContact?.id === c.id ? " active" : ""}`}
                  key={c.id}
                  onClick={() => setDmContact(dmContact?.id === c.id ? null : c)}
                  style={{ cursor: "pointer" }}
                >
                  <Avatar src={c.avatar} name={c.name} size={40} />
                  <div className="dash-item-info">
                    <span className="dash-item-title">{c.name}</span>
                    <span className="dash-item-sub">Clique para mensagem</span>
                  </div>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleRemoveContact(c.id); }} title="Remover">
                    <i className="bi bi-x" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "requests" && (
            <div className="dash-list">
              {requests.length === 0 && (
                <div className="dash-empty">
                  <i className="bi bi-person-check" />
                  <p>Nenhum pedido pendente.</p>
                </div>
              )}
              {requests.map((r) => (
                <div className="dash-item glass-card" key={r.id}>
                  <Avatar src={r.fromAvatar} name={r.fromName} size={40} />
                  <div className="dash-item-info">
                    <span className="dash-item-title">{r.fromName}</span>
                    <span className="dash-item-sub">{formatDate(r.at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-primary" style={{ padding: "5px 12px", fontSize: "0.78rem" }} onClick={() => handleAccept(r.id)}>
                      <i className="bi bi-check-lg" />
                    </button>
                    <button className="btn-ghost-sm" style={{ padding: "5px 10px" }} onClick={() => handleDecline(r.id)}>
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel DM */}
        {dmContact ? (
          <div className="dash-dm glass-card">
            <div className="dash-dm-header">
              <Avatar src={dmContact.avatar} name={dmContact.name} size={32} />
              <span>{dmContact.name}</span>
              <button className="icon-btn" onClick={() => setDmContact(null)} style={{ marginLeft: "auto" }}>
                <i className="bi bi-x" />
              </button>
            </div>
            <div className="dash-dm-messages">
              {dmMessages.length === 0 && (
                <div className="dash-empty" style={{ margin: "auto" }}>
                  <i className="bi bi-chat" /><p>Nenhuma mensagem ainda.</p>
                </div>
              )}
              {dmMessages.map((m) => (
                <div key={m.id} className={`dm-msg${m.fromId === user.id ? " own" : ""}`}>
                  <span className="dm-bubble">{m.text}</span>
                  {hasDice(m.text) && <DiceResult text={m.text} rollId={m.id} />}
                  <span className="dm-time">{formatDate(m.at)}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="dash-dm-input" onSubmit={handleSendDM}>
              <input value={dmText} onChange={(e) => setDmText(e.target.value)} placeholder={`Mensagem ou 2d6+3 para dados...`} maxLength={500} />
              <button type="submit" disabled={!dmText.trim()}><i className="bi bi-send-fill" /></button>
            </form>
          </div>
        ) : (
          <div className="dash-dm-placeholder">
            <i className="bi bi-chat-dots" />
            <p>Selecione um contato para enviar mensagem</p>
          </div>
        )}
      </div>
    </div>
  );
}
