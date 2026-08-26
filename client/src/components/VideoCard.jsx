import { useEffect, useRef } from "react";
import { getInitials } from "../utils/format.js";

export default function VideoCard({
  stream,
  name,
  avatar = null,
  isLocal = false,
  micOn = true,
  camOn = true,
  isSharingScreen = false,
  speaking = false,
  speakerId = null,
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

  const showVideo = camOn || isSharingScreen;

  return (
    <div
      className={[
        "video-card",
        speaking ? "is-speaking" : "",
        !showVideo ? "cam-off" : "",
        isLocal && !isSharingScreen ? "mirrored" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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

      <div className="video-card-tag">
        <i className={`bi ${micOn ? "bi-mic-fill" : "bi-mic-mute-fill"} mic-icon ${!micOn ? "muted" : ""}`} />
        <span className="name">{name}</span>
      </div>
    </div>
  );
}
