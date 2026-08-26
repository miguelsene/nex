import { useEffect, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { getCallHistory, getContacts, removeContact, getDMs, sendDM } from "../services/social.js";
import { createRoom } from "../services/api.js";

function formatDuration(s) {
  if (!s) return "0s";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("history"); // history | contacts
  const [history, setHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [dmContact, setDmContact] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmText, setDmText] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    setHistory(getCallHistory(user.id));
    setContacts(getContacts(user.id));
  }, [user]);

  useEffect(() => {
    if (dmContact && user) {
      setDmMessages(getDMs(user.id, dmContact.id));
    }
  }, [dmContact, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  async function handleNewCall() {
    setLoading(true);
    try {
      const { roomId } = await createRoom();
      navigate(`/room/${roomId}`, { state: { name: user.name } });
    } catch {
      setLoading(false);
    }
  }

  function handleRemoveContact(id) {
    removeContact(user.id, id);
    setContacts(getContacts(user.id));
    if (dmContact?.id === id) setDmContact(null);
  }

  function handleSendDM(e) {
    e.preventDefault();
    if (!dmText.trim() || !dmContact) return;
    sendDM(user.id, user.name, dmContact.id, dmText);
    setDmMessages(getDMs(user.id, dmContact.id));
    setDmText("");
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="dashboard">
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob b1" /><div className="aurora-blob b2" />
      </div>

      <header className="dash-header glass-card">
        <button className="btn-ghost-sm" onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="bi bi-arrow-left" /> Início
        </button>
        <div className="dash-user">
          {user.avatar
            ? <img src={user.avatar} alt={user.name} className="header-avatar" />
            : <div className="header-avatar-initials">{user.name.slice(0, 2).toUpperCase()}</div>
          }
          <span>{user.name}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" style={{ padding: "8px 18px", fontSize: "0.85rem" }} onClick={handleNewCall} disabled={loading}>
            <i className="bi bi-plus-circle-fill" /> {loading ? "Criando..." : "Nova sala"}
          </button>
          <button className="btn-ghost-sm" onClick={logout}>Sair</button>
        </div>
      </header>

      <div className="dash-body">
        {/* Painel esquerdo */}
        <div className="dash-left">
          <div className="dash-tabs">
            <button className={tab === "history" ? "dash-tab active" : "dash-tab"} onClick={() => setTab("history")}>
              <i className="bi bi-clock-history" /> Ligações
            </button>
            <button className={tab === "contacts" ? "dash-tab active" : "dash-tab"} onClick={() => setTab("contacts")}>
              <i className="bi bi-people-fill" /> Contatos
              {contacts.length > 0 && <span className="dash-badge">{contacts.length}</span>}
            </button>
          </div>

          {tab === "history" && (
            <div className="dash-list">
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
                      {call.participants?.length > 0 && (
                        <> · <i className="bi bi-people" /> {call.participants.join(", ")}</>
                      )}
                    </span>
                    <span className="dash-item-date">{formatDate(call.at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "contacts" && (
            <div className="dash-list">
              {contacts.length === 0 && (
                <div className="dash-empty">
                  <i className="bi bi-person-plus" />
                  <p>Nenhum contato ainda.<br />Adicione pessoas do histórico de ligações.</p>
                </div>
              )}
              {contacts.map((c) => (
                <div
                  className={`dash-item glass-card${dmContact?.id === c.id ? " active" : ""}`}
                  key={c.id}
                  onClick={() => setDmContact(dmContact?.id === c.id ? null : c)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="dash-contact-avatar">
                    {c.avatar
                      ? <img src={c.avatar} alt={c.name} />
                      : <span>{c.name.slice(0, 2).toUpperCase()}</span>
                    }
                  </div>
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
        </div>

        {/* Painel direito — DM */}
        {dmContact ? (
          <div className="dash-dm glass-card">
            <div className="dash-dm-header">
              <div className="dash-contact-avatar sm">
                {dmContact.avatar
                  ? <img src={dmContact.avatar} alt={dmContact.name} />
                  : <span>{dmContact.name.slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <span>{dmContact.name}</span>
              <button className="icon-btn" onClick={() => setDmContact(null)} style={{ marginLeft: "auto" }}>
                <i className="bi bi-x" />
              </button>
            </div>
            <div className="dash-dm-messages">
              {dmMessages.length === 0 && (
                <div className="dash-empty" style={{ margin: "auto" }}>
                  <i className="bi bi-chat" />
                  <p>Nenhuma mensagem ainda.</p>
                </div>
              )}
              {dmMessages.map((m) => (
                <div key={m.id} className={`dm-msg${m.fromId === user.id ? " own" : ""}`}>
                  <span className="dm-bubble">{m.text}</span>
                  <span className="dm-time">{formatDate(m.at)}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="dash-dm-input" onSubmit={handleSendDM}>
              <input
                value={dmText}
                onChange={(e) => setDmText(e.target.value)}
                placeholder={`Mensagem para ${dmContact.name}...`}
                maxLength={500}
              />
              <button type="submit" disabled={!dmText.trim()}>
                <i className="bi bi-send-fill" />
              </button>
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
