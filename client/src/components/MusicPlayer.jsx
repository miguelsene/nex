import { useCallback, useEffect, useRef, useState } from "react";

function extractVideoId(url) {
  try {
    const u = new URL(url.includes("://") ? url : "https://" + url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    return u.searchParams.get("v") || null;
  } catch {
    return null;
  }
}

export default function MusicPlayer({ socket, isHost, onClose }) {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(50);
  const [error, setError] = useState(null);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const readyRef = useRef(false);

  // Carrega a YouTube IFrame API uma vez
  useEffect(() => {
    if (window.YT) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }, []);

  // Cria/recria o player quando videoId muda
  useEffect(() => {
    if (!videoId) return;
    readyRef.current = false;

    function init() {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      playerRef.current = new window.YT.Player(iframeRef.current, {
        videoId,
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, loop: loop ? 1 : 0, playlist: loop ? videoId : undefined },
        events: {
          onReady: (e) => {
            readyRef.current = true;
            e.target.setVolume(volume);
          },
          onStateChange: (e) => {
            const YT = window.YT.PlayerState;
            if (e.data === YT.ENDED && loop) {
              playerRef.current?.seekTo(0);
              playerRef.current?.playVideo();
            }
            if (e.data === YT.ENDED && !loop) setPlaying(false);
          },
        },
      });
    }

    if (window.YT?.Player) {
      init();
    } else {
      window.onYouTubeIframeAPIReady = init;
    }

    return () => {
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [videoId]); // eslint-disable-line

  // Recebe atualizações dos outros participantes
  useEffect(() => {
    if (!socket) return;
    function onMusicUpdate({ action, videoId: vid, currentTime, loop: lp, volume: vol }) {
      if (vid && vid !== videoId) setVideoId(vid);
      if (lp !== undefined) setLoop(lp);
      if (vol !== undefined) { setVolume(vol); playerRef.current?.setVolume?.(vol); }
      if (!readyRef.current) return;
      if (action === "play") { playerRef.current?.seekTo?.(currentTime || 0); playerRef.current?.playVideo?.(); setPlaying(true); }
      if (action === "pause") { playerRef.current?.pauseVideo?.(); setPlaying(false); }
      if (action === "seek") { playerRef.current?.seekTo?.(currentTime || 0); }
    }
    socket.on("music-update", onMusicUpdate);
    return () => socket.off("music-update", onMusicUpdate);
  }, [socket, videoId]);

  const broadcast = useCallback((data) => {
    socket?.emit("music-update", data);
  }, [socket]);

  function handleLoad(e) {
    e.preventDefault();
    const id = extractVideoId(url.trim());
    if (!id) { setError("Link inválido. Use um link do YouTube."); return; }
    setError(null);
    setVideoId(id);
    setPlaying(false);
    broadcast({ action: "load", videoId: id });
  }

  function handlePlay() {
    if (!readyRef.current) return;
    const t = playerRef.current?.getCurrentTime?.() || 0;
    playerRef.current?.playVideo?.();
    setPlaying(true);
    broadcast({ action: "play", videoId, currentTime: t });
  }

  function handlePause() {
    if (!readyRef.current) return;
    playerRef.current?.pauseVideo?.();
    setPlaying(false);
    broadcast({ action: "pause", videoId });
  }

  function handleSeek(e) {
    const t = Number(e.target.value);
    playerRef.current?.seekTo?.(t);
    broadcast({ action: "seek", videoId, currentTime: t });
  }

  function handleVolume(e) {
    const v = Number(e.target.value);
    setVolume(v);
    playerRef.current?.setVolume?.(v);
    broadcast({ action: "volume", videoId, volume: v });
  }

  function handleLoop() {
    const next = !loop;
    setLoop(next);
    broadcast({ action: "loop", videoId, loop: next });
  }

  function handleSkip(secs) {
    if (!readyRef.current) return;
    const t = (playerRef.current?.getCurrentTime?.() || 0) + secs;
    playerRef.current?.seekTo?.(t);
    broadcast({ action: "seek", videoId, currentTime: t });
  }

  return (
    <div className="side-panel music-panel">
      <div className="side-panel-header">
        <h3><i className="bi bi-music-note-beamed" /> Música</h3>
        <button className="icon-btn" onClick={onClose}><i className="bi bi-x-lg" /></button>
      </div>

      <div className="music-body">
        {isHost && (
          <form className="music-url-form" onSubmit={handleLoad}>
            <div className="name-input-wrap" style={{ flex: 1 }}>
              <i className="bi bi-youtube" style={{ color: "#ff0000" }} />
              <input
                type="text"
                placeholder="Link do YouTube..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-ghost-sm">Carregar</button>
          </form>
        )}
        {error && <div className="error-text" style={{ padding: "0 4px" }}>{error}</div>}

        {/* Container do player — sempre presente para o YT API poder montar */}
        <div className={`music-player-wrap${videoId ? "" : " hidden"}`}>
          <div ref={iframeRef} />
        </div>

        {!videoId && (
          <div className="dash-empty" style={{ padding: "30px 20px" }}>
            <i className="bi bi-music-note-list" />
            <p>{isHost ? "Cole um link do YouTube acima." : "Aguardando o host carregar uma música."}</p>
          </div>
        )}

        {videoId && (
          <div className="music-controls">
            <div className="music-btns">
              <button className="icon-btn" onClick={() => handleSkip(-10)} title="Voltar 10s">
                <i className="bi bi-skip-backward-fill" />
              </button>
              <button className="music-play-btn" onClick={playing ? handlePause : handlePlay}>
                <i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"}`} />
              </button>
              <button className="icon-btn" onClick={() => handleSkip(10)} title="Avançar 10s">
                <i className="bi bi-skip-forward-fill" />
              </button>
              <button className={`icon-btn${loop ? " active-icon" : ""}`} onClick={handleLoop} title="Loop">
                <i className="bi bi-arrow-repeat" />
              </button>
            </div>

            <div className="music-volume">
              <i className="bi bi-volume-down-fill" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }} />
              <input type="range" min={0} max={100} value={volume} onChange={handleVolume} className="music-range" />
              <i className="bi bi-volume-up-fill" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
