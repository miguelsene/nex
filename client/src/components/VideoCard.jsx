import { useEffect, useRef } from "react";
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      // Força re-play quando a stream muda de tracks (ex: compartilhamento de tela)
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  // Re-attach quando as tracks da stream mudam (câmera -> tela e vice-versa)
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

  const showVideo = camOn || isSharingScreen;

  return (
    <div
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
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu?.({ event, participant: { id, name, isLocal, micOn, camOn, isSharingScreen } });
      }}
    >
      <video ref={videoRef} autoPlay playsInline muted={isLocal} />

      <div className="avatar-fallback">
        {avatar
          ? <img src={avatar} alt={name} className="avatar-circle" style={{ objectFit: "cover" }} />
          : <div className="avatar-circle">{getInitials(name)}</div>
        }
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
        onClick={(event) => {
          event.stopPropagation();
          onTogglePin?.();
        }}
      >
        <i className={`bi ${isPinned ? "bi-fullscreen-exit" : "bi-arrows-fullscreen"}`} />
      </button>

      {isPinned && (
        <button
          type="button"
          className="video-focus-btn"
          data-tooltip={focusMode ? "Mostrar participantes" : "Ocultar participantes"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFocus?.();
          }}
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
