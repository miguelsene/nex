import { useEffect, useRef, useCallback } from "react";
import { getInitials } from "../utils/format.js";

export default function VideoCard({
  id,
  stream,
  name,
  avatar = null,
  isLocal = false,
  micOn = true,
  camOn = true,
  isSharingScreen = false,
  speaking = false,
  speakerId = null,
  volume = 1,
  isPinned = false,
  compact = false,
  focusMode = false,
  onTogglePin,
  onToggleFocus,
  onOpenMenu,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      if (video.srcObject !== stream) video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    if (!stream) return;
    const video = videoRef.current;
    const onAddTrack = () => {
      if (video && video.srcObject !== stream) video.srcObject = stream;
      video?.play().catch(() => {});
    };
    stream.addEventListener("addtrack", onAddTrack);
    stream.addEventListener("removetrack", onAddTrack);
    return () => {
      stream.removeEventListener("addtrack", onAddTrack);
      stream.removeEventListener("removetrack", onAddTrack);
    };
  }, [stream]);

  useEffect(() => {
    if (!isLocal && videoRef.current && speakerId && typeof videoRef.current.setSinkId === "function") {
      videoRef.current.setSinkId(speakerId).catch(() => {});
    }
  }, [speakerId, isLocal]);

  useEffect(() => {
    if (!videoRef.current || isLocal) return;
    videoRef.current.volume = Math.min(1, Math.max(0, volume));
  }, [volume, isLocal]);

  const handleFullscreen = useCallback((e) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const showVideo = camOn || isSharingScreen;

  return (
    <div
      ref={containerRef}
      className={[
        "video-card",
        speaking ? "is-speaking" : "",
        !showVideo ? "cam-off" : "",
        isLocal && !isSharingScreen ? "mirrored" : "",
        isPinned ? "is-pinned" : "",
        compact ? "is-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDoubleClick={onTogglePin}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu?.({ event: e, participant: { id, name, isLocal, micOn, camOn, isSharingScreen } });
      }}
    >
      {speaking && <div className="speaking-ring" />}

      <video ref={videoRef} autoPlay playsInline muted={isLocal} />

      <div className="avatar-fallback">
        {avatar
          ? <img src={avatar} alt={name} className="avatar-circle" style={{ objectFit: "cover" }} />
          : <div className="avatar-circle">{getInitials(name)}</div>
        }
        <span className="avatar-name">{name}</span>
      </div>

      <div className="video-card-badge">
        {isLocal && <span className="badge-you">Você</span>}
        {isSharingScreen && (
          <span className="badge-screen">
            <i className="bi bi-display" /> Tela
          </span>
        )}
      </div>

      <button
        type="button"
        className="video-pin-btn"
        data-tooltip={isPinned ? "Restaurar grade" : "Maximizar"}
        onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
      >
        <i className={`bi ${isPinned ? "bi-fullscreen-exit" : "bi-arrows-fullscreen"}`} />
      </button>

      <button
        type="button"
        className="video-fullscreen-btn"
        data-tooltip="Tela cheia"
        onClick={handleFullscreen}
      >
        <i className="bi bi-fullscreen" />
      </button>

      {isPinned && (
        <button
          type="button"
          className="video-focus-btn"
          data-tooltip={focusMode ? "Mostrar participantes" : "Ocultar participantes"}
          onClick={(e) => { e.stopPropagation(); onToggleFocus?.(); }}
        >
          <i className={`bi ${focusMode ? "bi-layout-sidebar-inset" : "bi-person-video2"}`} />
        </button>
      )}

      <div className="video-card-tag">
        <i className={`bi ${micOn ? "bi-mic-fill" : "bi-mic-mute-fill"} mic-icon ${!micOn ? "muted" : ""}`} />
        <span className="name">{name}</span>
      </div>
    </div>
  );
}
