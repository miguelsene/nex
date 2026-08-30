export default function CallControls({
  micOn, camOn, isSharingScreen, activePanel,
  participantCount, unreadChatCount,
  focusMode = false, isRecording = false,
  controlBarRef,
  onToggleMic, onToggleCam, onToggleScreenShare,
  onTogglePanel, onOpenInvite, onOpenSettings,
  onToggleFocusMode, onToggleRecording, onQuickReaction,
  onMinimize, onLeave,
}) {
  return (
    <div className="control-bar" ref={controlBarRef} role="toolbar" aria-label="Controles da chamada" tabIndex={-1}>
      <button type="button" className={`control-btn ${micOn ? "" : "off"}`} data-tooltip={micOn ? "Desligar microfone" : "Ligar microfone"} aria-label={micOn ? "Desligar microfone" : "Ligar microfone"} onClick={onToggleMic} aria-pressed={micOn}>
        <i className={`bi ${micOn ? "bi-mic-fill" : "bi-mic-mute-fill"}`} />
      </button>
      <button type="button" className={`control-btn ${camOn ? "" : "off"}`} data-tooltip={camOn ? "Desligar câmera" : "Ligar câmera"} aria-label={camOn ? "Desligar câmera" : "Ligar câmera"} onClick={onToggleCam} aria-pressed={camOn}>
        <i className={`bi ${camOn ? "bi-camera-video-fill" : "bi-camera-video-off-fill"}`} />
      </button>
      <button type="button" className={`control-btn ${isSharingScreen ? "active" : ""}`} data-tooltip={isSharingScreen ? "Parar compartilhamento" : "Compartilhar tela"} aria-label={isSharingScreen ? "Parar compartilhamento de tela" : "Compartilhar tela"} onClick={onToggleScreenShare} aria-pressed={isSharingScreen}>
        <i className="bi bi-display" />
      </button>
      <button type="button" className={`control-btn ${isRecording ? "recording" : ""}`} data-tooltip={isRecording ? "Parar gravação" : "Gravar chamada"} aria-label={isRecording ? "Parar gravação da chamada" : "Gravar chamada"} onClick={onToggleRecording} aria-pressed={isRecording}>
        <i className={`bi ${isRecording ? "bi-record-circle-fill" : "bi-record-circle"}`} />
      </button>

      <button type="button" className="control-btn" data-tooltip="Minimizar chamada" aria-label="Minimizar chamada" onClick={onMinimize}>
        <i className="bi bi-pip-fill" />
      </button>

      <div className="control-divider" aria-hidden="true" />

      <button type="button" className={`control-btn ${activePanel === "chat" ? "active" : ""}`} data-tooltip="Chat" aria-label="Abrir chat" onClick={() => onTogglePanel("chat")} aria-pressed={activePanel === "chat"}>
        <i className="bi bi-chat-dots-fill" />
        {unreadChatCount > 0 && <span className="badge-count">{unreadChatCount}</span>}
      </button>
      <button type="button" className={`control-btn ${activePanel === "participants" ? "active" : ""}`} data-tooltip="Participantes" aria-label="Abrir participantes" onClick={() => onTogglePanel("participants")} aria-pressed={activePanel === "participants"}>
        <i className="bi bi-people-fill" />
        <span className="badge-count">{participantCount}</span>
      </button>
      <button type="button" className={`control-btn ${activePanel === "music" ? "active" : ""}`} data-tooltip="Música" aria-label="Abrir música" onClick={() => onTogglePanel("music")} aria-pressed={activePanel === "music"}>
        <i className="bi bi-music-note-beamed" />
      </button>
      <button type="button" className={`control-btn ${focusMode ? "active" : ""}`} data-tooltip={focusMode ? "Sair do foco" : "Ativar foco"} aria-label={focusMode ? "Sair do foco" : "Ativar foco"} onClick={onToggleFocusMode} aria-pressed={focusMode}>
        <i className="bi bi-focus" />
      </button>
      <button type="button" className="control-btn" data-tooltip="Convidar" aria-label="Copiar convite da sala" onClick={onOpenInvite}>
        <i className="bi bi-link-45deg" />
      </button>
      <button type="button" className="control-btn" data-tooltip="Configurações" aria-label="Abrir configurações" onClick={onOpenSettings}>
        <i className="bi bi-gear-fill" />
      </button>

      <div className="reaction-strip" aria-label="Reações rápidas">
        <button type="button" className="reaction-btn" aria-label="Reagir com coração" onClick={() => onQuickReaction?.("❤️")}>❤️</button>
        <button type="button" className="reaction-btn" aria-label="Reagir com joinha" onClick={() => onQuickReaction?.("👍")}>👍</button>
        <button type="button" className="reaction-btn" aria-label="Reagir com festa" onClick={() => onQuickReaction?.("🎉")}>🎉</button>
      </div>

      <div className="control-divider" aria-hidden="true" />

      <button type="button" className="control-btn leave" aria-label="Sair da sala" onClick={onLeave}>
        <i className="bi bi-telephone-x-fill" />
        <span>Sair</span>
      </button>
    </div>
  );
}
