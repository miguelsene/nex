import { useEffect, useRef } from "react";
import { getInitials } from "../utils/format.js";

export default function VideoCard({
  stream,
  name,
  isLocal = false,
  micOn = true,
  camOn = true,
  isSharingScreen = false,
  speaking = false,
  speakerId = null,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
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
        <div className="avatar-circle">{getInitials(name)}</div>
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
