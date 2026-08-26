import { useEffect, useRef, useState } from "react";
import { formatTime } from "../utils/format.js";
import { parseDice, hasDice } from "../utils/dice.js";

function DiceResult({ text }) {
  const groups = parseDice(text);
  if (!groups.length) return null;
  return (
    <div className="dice-result">
      <i className="bi bi-dice-5-fill" style={{ color: "var(--accent-cyan)", fontSize: "0.85rem" }} />
      {groups.map((g, i) => (
        <span key={i} className="dice-group">
          <span className="dice-expr">{g.expr}</span>
          <span className="dice-rolls">
            [{g.rolls.join(", ")}]{g.mod !== 0 ? ` ${g.mod > 0 ? "+" : ""}${g.mod}` : ""}
          </span>
          <span className="dice-total">{g.sum}</span>
          {i < groups.length - 1 && <span style={{ color: "var(--text-muted)" }}> · </span>}
        </span>
      ))}
    </div>
  );
}

export default function Chat({ messages, selfId, onSend, onClose }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h3>Chat</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar chat">
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="chat-panel">
        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <i className="bi bi-chat-square-text" />
              <span>Nenhuma mensagem ainda. Diga oi!</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                Dica: digite <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4 }}>2d6+3</code> para rolar dados 🎲
              </span>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.senderId === selfId ? "own" : ""}`}>
              <div className="meta">
                <span className="sender">{msg.senderId === selfId ? "Você" : msg.name}</span>
                <span>{formatTime(msg.timestamp)}</span>
              </div>
              <div className="bubble">{msg.text}</div>
              {hasDice(msg.text) && <DiceResult text={msg.text} />}
            </div>
          ))}
        </div>

        <form className="chat-input-row" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Mensagem ou 2d6+3 para dados..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
          />
          <button type="submit" disabled={!draft.trim()} aria-label="Enviar mensagem">
            <i className="bi bi-send-fill" />
          </button>
        </form>
      </div>
    </div>
  );
}
