export default function CallControls({
  micOn,
  camOn,
  isSharingScreen,
  activePanel,
  participantCount,
  unreadChatCount,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onTogglePanel,
  onOpenInvite,
  onOpenSettings,
  onLeave,
}) {
  return (
    <div className="control-bar">
      <button
        type="button"
        className={`control-btn ${micOn ? "" : "off"}`}
        data-tooltip={micOn ? "Desligar microfone" : "Ligar microfone"}
        onClick={onToggleMic}
        aria-pressed={micOn}
        aria-label="Alternar microfone"
      >
        <i className={`bi ${micOn ? "bi-mic-fill" : "bi-mic-mute-fill"}`} />
      </button>

      <button
        type="button"
        className={`control-btn ${camOn ? "" : "off"}`}
        data-tooltip={camOn ? "Desligar câmera" : "Ligar câmera"}
        onClick={onToggleCam}
        aria-pressed={camOn}
        aria-label="Alternar câmera"
      >
        <i className={`bi ${camOn ? "bi-camera-video-fill" : "bi-camera-video-off-fill"}`} />
      </button>

      <button
        type="button"
        className={`control-btn ${isSharingScreen ? "active" : ""}`}
        data-tooltip={isSharingScreen ? "Parar compartilhamento" : "Compartilhar tela"}
        onClick={onToggleScreenShare}
        aria-pressed={isSharingScreen}
        aria-label="Compartilhar tela"
      >
        <i className="bi bi-display" />
      </button>

      <div className="control-divider" />

      <button
        type="button"
        className={`control-btn ${activePanel === "chat" ? "active" : ""}`}
        data-tooltip="Chat"
        onClick={() => onTogglePanel("chat")}
        aria-label="Abrir chat"
      >
        <i className="bi bi-chat-dots-fill" />
        {unreadChatCount > 0 && <span className="badge-count">{unreadChatCount}</span>}
      </button>

      <button
        type="button"
        className={`control-btn ${activePanel === "participants" ? "active" : ""}`}
        data-tooltip="Participantes"
        onClick={() => onTogglePanel("participants")}
        aria-label="Abrir participantes"
      >
        <i className="bi bi-people-fill" />
        <span className="badge-count">{participantCount}</span>
      </button>

      <button
        type="button"
        className="control-btn"
        data-tooltip="Convidar"
        onClick={onOpenInvite}
        aria-label="Convidar participantes"
      >
        <i className="bi bi-link-45deg" />
      </button>

      <button
        type="button"
        className="control-btn"
        data-tooltip="Configurações"
        onClick={onOpenSettings}
        aria-label="Abrir configurações"
      >
        <i className="bi bi-gear-fill" />
      </button>

      <div className="control-divider" />

      <button type="button" className="control-btn leave" onClick={onLeave} aria-label="Sair da chamada">
        <i className="bi bi-telephone-x-fill" />
        <span>Sair</span>
      </button>
    </div>
  );
}
