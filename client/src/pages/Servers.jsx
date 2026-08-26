import { useEffect, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { parseDice, hasDice } from "../utils/dice.js";
import {
  createServer, getMyServers, joinServer, leaveServer,
  getServerMessages, sendServerMessage, addChannel, regenerateInvite,
} from "../services/servers.js";

function DiceResult({ text }) {
  const groups = parseDice(text);
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

function formatDate(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ServerIcon({ server, size = 44, active }) {
  const style = {
    width: size, height: size, borderRadius: active ? "35%" : "50%",
    objectFit: "cover", flexShrink: 0, cursor: "pointer",
    transition: "border-radius 0.2s",
    border: active ? "2px solid var(--accent-cyan)" : "2px solid transparent",
  };
  if (server.icon) return <img src={server.icon} alt={server.name} style={style} />;
  return (
    <div style={{ ...style, background: "var(--gradient-aurora)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#0a0d16" }}>
      {server.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Avatar({ src, name, size = 32 }) {
  const s = { width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
  if (src) return <img src={src} alt={name} style={s} />;
  return <div style={{ ...s, background: "var(--gradient-aurora)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, color: "#0a0d16" }}>{(name || "?").slice(0, 2).toUpperCase()}</div>;
}

export default function Servers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [view, setView] = useState("channels"); // channels | members
  const [modal, setModal] = useState(null); // null | create | join | invite | addChannel
  const messagesEndRef = useRef(null);

  // Modal criar servidor
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(null);
  const iconRef = useRef(null);

  // Modal entrar
  const [inviteInput, setInviteInput] = useState("");
  const [joinError, setJoinError] = useState(null);

  // Modal add canal
  const [newChName, setNewChName] = useState("");

  if (!user) return <Navigate to="/auth" replace />;

  function reload() {
    const list = getMyServers(user.id);
    setServers(list);
    if (activeServer) {
      const updated = list.find((s) => s.id === activeServer.id);
      setActiveServer(updated || null);
      if (!updated) { setActiveChannel(null); setMessages([]); }
    }
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { reload(); }, []); // eslint-disable-line

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (activeChannel && activeServer) {
      setMessages(getServerMessages(activeServer.id, activeChannel.id));
    }
  }, [activeChannel, activeServer]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function selectServer(s) {
    setActiveServer(s);
    const firstText = s.channels.find((c) => c.type === "text");
    setActiveChannel(firstText || null);
    setMessages(firstText ? getServerMessages(s.id, firstText.id) : []);
    setView("channels");
  }

  function selectChannel(ch) {
    setActiveChannel(ch);
    setMessages(getServerMessages(activeServer.id, ch.id));
  }

  function handleSendMsg(e) {
    e.preventDefault();
    if (!msgText.trim() || !activeChannel || !activeServer) return;
    sendServerMessage(activeServer.id, activeChannel.id, user, msgText);
    setMessages(getServerMessages(activeServer.id, activeChannel.id));
    setMsgText("");
  }

  function handleIconChange(e) {
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
        setNewIcon(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const s = createServer(user, newName, newIcon);
    setModal(null); setNewName(""); setNewIcon(null);
    reload();
    selectServer(s);
  }

  function handleJoin(e) {
    e.preventDefault();
    setJoinError(null);
    const result = joinServer(user, inviteInput);
    if (!result.ok) { setJoinError(result.error); return; }
    setModal(null); setInviteInput("");
    reload();
    selectServer(result.server);
  }

  function handleAddChannel(e) {
    e.preventDefault();
    if (!newChName.trim()) return;
    addChannel(activeServer.id, user.id, newChName);
    setModal(null); setNewChName("");
    reload();
  }

  function handleLeave() {
    if (!activeServer) return;
    leaveServer(user.id, activeServer.id);
    setActiveServer(null); setActiveChannel(null); setMessages([]);
    reload();
  }

  function handleRegenInvite() {
    if (!activeServer) return;
    regenerateInvite(activeServer.id, user.id);
    reload();
  }

  function copyInvite() {
    if (!activeServer) return;
    navigator.clipboard.writeText(activeServer.inviteCode).catch(() => {});
  }

  return (
    <div className="servers-page">
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob b1" /><div className="aurora-blob b2" />
      </div>

      {/* Sidebar de servidores */}
      <div className="servers-sidebar">
        <button className="server-icon-btn" onClick={() => navigate("/")} title="Início">
          <div className="server-icon-home"><i className="bi bi-house-fill" /></div>
        </button>
        <div className="server-divider" />
        {servers.map((s) => (
          <button key={s.id} className="server-icon-btn" onClick={() => selectServer(s)} title={s.name}>
            <ServerIcon server={s} active={activeServer?.id === s.id} />
          </button>
        ))}
        <div className="server-divider" />
        <button className="server-icon-btn" onClick={() => setModal("create")} title="Criar servidor">
          <div className="server-icon-add"><i className="bi bi-plus-lg" /></div>
        </button>
        <button className="server-icon-btn" onClick={() => setModal("join")} title="Entrar em servidor">
          <div className="server-icon-add" style={{ background: "rgba(255,255,255,0.06)" }}><i className="bi bi-box-arrow-in-right" /></div>
        </button>
      </div>

      {/* Painel de canais */}
      {activeServer ? (
        <div className="server-channels-panel glass-card">
          <div className="server-channels-header">
            <span className="server-channels-name">{activeServer.name}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="icon-btn" onClick={() => setModal("invite")} title="Convidar"><i className="bi bi-person-plus-fill" /></button>
              {activeServer.ownerId === user.id && (
                <button className="icon-btn" onClick={() => setModal("addChannel")} title="Novo canal"><i className="bi bi-plus-lg" /></button>
              )}
              <button className="icon-btn" onClick={() => setView(view === "members" ? "channels" : "members")} title="Membros">
                <i className="bi bi-people-fill" />
              </button>
            </div>
          </div>

          {view === "channels" && (
            <div className="server-channel-list">
              <div className="server-section-label">Canais de texto</div>
              {activeServer.channels.filter((c) => c.type === "text").map((ch) => (
                <button
                  key={ch.id}
                  className={`server-channel-item${activeChannel?.id === ch.id ? " active" : ""}`}
                  onClick={() => selectChannel(ch)}
                >
                  <i className="bi bi-hash" /> {ch.name}
                </button>
              ))}
            </div>
          )}

          {view === "members" && (
            <div className="server-channel-list">
              <div className="server-section-label">{activeServer.members.length} membros</div>
              {activeServer.members.map((m) => (
                <div key={m.id} className="server-member-row">
                  <Avatar src={m.avatar} name={m.name} size={30} />
                  <span>{m.name}</span>
                  {m.role === "owner" && <span style={{ fontSize: "0.65rem", color: "var(--accent-cyan)", marginLeft: "auto" }}>dono</span>}
                </div>
              ))}
            </div>
          )}

          <button className="server-leave-btn" onClick={handleLeave}>
            <i className="bi bi-box-arrow-left" /> {activeServer.ownerId === user.id ? "Deletar servidor" : "Sair do servidor"}
          </button>
        </div>
      ) : (
        <div className="server-channels-panel glass-card server-empty-panel">
          <i className="bi bi-server" />
          <p>Selecione um servidor ou crie um novo</p>
          <button className="btn btn-primary" onClick={() => setModal("create")}>
            <i className="bi bi-plus-circle-fill" /> Criar servidor
          </button>
          <button className="btn-ghost-sm" onClick={() => setModal("join")}>
            <i className="bi bi-box-arrow-in-right" /> Entrar com código
          </button>
        </div>
      )}

      {/* Área de mensagens */}
      {activeServer && activeChannel ? (
        <div className="server-chat">
          <div className="server-chat-header">
            <i className="bi bi-hash" /> {activeChannel.name}
          </div>
          <div className="server-chat-messages">
            {messages.length === 0 && (
              <div className="dash-empty" style={{ margin: "auto" }}>
                <i className="bi bi-chat" />
                <p>Nenhuma mensagem ainda em #{activeChannel.name}</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className="server-msg">
                <Avatar src={m.fromAvatar} name={m.fromName} size={34} />
                <div className="server-msg-body">
                  <div className="server-msg-meta">
                    <span className="server-msg-name">{m.fromName}</span>
                    <span className="server-msg-time">{formatDate(m.at)}</span>
                  </div>
                  <div className="server-msg-text">{m.text}</div>
                  {hasDice(m.text) && <DiceResult text={m.text} />}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form className="server-chat-input" onSubmit={handleSendMsg}>
            <input
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder={`Mensagem em #${activeChannel.name}`}
              maxLength={500}
            />
            <button type="submit" disabled={!msgText.trim()}><i className="bi bi-send-fill" /></button>
          </form>
        </div>
      ) : activeServer ? (
        <div className="server-chat" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
          <div className="dash-empty"><i className="bi bi-hash" /><p>Selecione um canal</p></div>
        </div>
      ) : null}

      {/* Modais */}
      {modal && (
        <div className="modal-overlay" onClick={() => { setModal(null); setJoinError(null); }}>
          <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>

            {modal === "create" && (
              <>
                <div className="modal-header"><h3>Criar servidor</h3><button className="icon-btn" onClick={() => setModal(null)}><i className="bi bi-x-lg" /></button></div>
                <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div className="avatar-upload-wrap" onClick={() => iconRef.current?.click()}>
                      {newIcon ? <img src={newIcon} alt="icon" className="avatar-upload-preview" /> : <div className="avatar-upload-placeholder"><i className="bi bi-image" /><span>Ícone</span></div>}
                    </div>
                    <input ref={iconRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleIconChange} />
                  </div>
                  <div className="name-input-wrap">
                    <i className="bi bi-server" />
                    <input type="text" placeholder="Nome do servidor" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} autoFocus />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>Criar</button>
                </form>
              </>
            )}

            {modal === "join" && (
              <>
                <div className="modal-header"><h3>Entrar em servidor</h3><button className="icon-btn" onClick={() => setModal(null)}><i className="bi bi-x-lg" /></button></div>
                <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="name-input-wrap">
                    <i className="bi bi-key-fill" />
                    <input type="text" placeholder="Código de convite" value={inviteInput} onChange={(e) => setInviteInput(e.target.value.toUpperCase())} maxLength={10} autoFocus />
                  </div>
                  {joinError && <div className="error-text">{joinError}</div>}
                  <button type="submit" className="btn btn-primary">Entrar</button>
                </form>
              </>
            )}

            {modal === "invite" && activeServer && (
              <>
                <div className="modal-header"><h3>Convidar pessoas</h3><button className="icon-btn" onClick={() => setModal(null)}><i className="bi bi-x-lg" /></button></div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Compartilhe o código abaixo para convidar alguém para <strong>{activeServer.name}</strong>.</p>
                <div className="invite-link-box">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", letterSpacing: "0.1em", color: "var(--accent-cyan)" }}>{activeServer.inviteCode}</span>
                  <button className="btn-ghost-sm" onClick={copyInvite}><i className="bi bi-clipboard" /> Copiar</button>
                </div>
                {activeServer.ownerId === user.id && (
                  <button className="btn-ghost-sm" onClick={handleRegenInvite} style={{ alignSelf: "flex-start" }}>
                    <i className="bi bi-arrow-repeat" /> Gerar novo código
                  </button>
                )}
              </>
            )}

            {modal === "addChannel" && (
              <>
                <div className="modal-header"><h3>Novo canal</h3><button className="icon-btn" onClick={() => setModal(null)}><i className="bi bi-x-lg" /></button></div>
                <form onSubmit={handleAddChannel} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="name-input-wrap">
                    <i className="bi bi-hash" />
                    <input type="text" placeholder="nome-do-canal" value={newChName} onChange={(e) => setNewChName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} maxLength={30} autoFocus />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={!newChName.trim()}>Criar canal</button>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
