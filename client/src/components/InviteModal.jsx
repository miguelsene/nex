import { useState } from "react";

export default function InviteModal({ inviteUrl, roomId, onClose }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: seleciona o texto para o usuário copiar manualmente
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Entre na minha chamada",
          text: "Você foi convidado para uma chamada de vídeo.",
          url: inviteUrl,
        });
      } catch {
        // Usuário cancelou o compartilhamento — sem problema
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Convide seus amigos</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <p>Qualquer pessoa com este link pode entrar na sua chamada.</p>

        <div className="room-code-pill" style={{ alignSelf: "flex-start" }}>
          <i className="bi bi-hash" />
          <span className="code-label">Código da sala:</span> {roomId}
        </div>

        <div className="invite-link-box">
          <span>{inviteUrl}</span>
          <button type="button" className="btn btn-primary" style={{ padding: "9px 16px" }} onClick={handleCopy}>
            <i className="bi bi-clipboard" /> Copiar
          </button>
        </div>

        {copied && (
          <div className="copy-feedback">
            <i className="bi bi-check-circle-fill" /> Link copiado!
          </div>
        )}

        {typeof navigator !== "undefined" && navigator.share && (
          <button type="button" className="btn btn-ghost" onClick={handleNativeShare}>
            <i className="bi bi-share-fill" /> Compartilhar por outro app
          </button>
        )}
      </div>
    </div>
  );
}
