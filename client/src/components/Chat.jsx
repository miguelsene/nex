import { useEffect, useRef, useState } from "react";
import { formatTime } from "../utils/format.js";

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
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.senderId === selfId ? "own" : ""}`}>
              <div className="meta">
                <span className="sender">{msg.senderId === selfId ? "Você" : msg.name}</span>
                <span>{formatTime(msg.timestamp)}</span>
              </div>
              <div className="bubble">{msg.text}</div>
            </div>
          ))}
        </div>

        <form className="chat-input-row" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Escreva uma mensagem..."
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
