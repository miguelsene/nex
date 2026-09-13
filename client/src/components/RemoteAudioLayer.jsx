import { useEffect, useRef } from "react";

// Áudio remoto dedicado: um <audio> por peer, sempre montado.
// Sem isso, esconder os <video> (minimizar) mata o som junto.
export function RemoteAudioLayer({ peers }) {
  return (
    <div className="remote-audio-layer" aria-hidden="true">
      {Array.from(peers.values()).map((p) =>
        p.stream ? <PeerAudio key={p.id} stream={p.stream} /> : null
      )}
    </div>
  );
}

function PeerAudio({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});
    const onAdd = () => el.play().catch(() => {});
    stream.addEventListener("addtrack", onAdd);
    return () => stream.removeEventListener("addtrack", onAdd);
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
}
