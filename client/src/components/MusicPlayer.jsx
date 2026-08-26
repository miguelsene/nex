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

const PLAYER_DIV_ID = "yt-music-player-mount";

export default function MusicPlayer({ socket, isHost, onClose, visible }) {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(50);
  const [error, setError] = useState(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const loopRef = useRef(loop);
  const volumeRef = useRef(volume);
  const pendingUpdateRef = useRef(null);

  loopRef.current = loop;
  volumeRef.current = volume;

  function applyMusicUpdate({ action, currentTime, loop: lp, volume: vol }) {
    if (lp !== undefined) setLoop(lp);
    if (vol !== undefined) { setVolume(vol); playerRef.current?.setVolume?.(vol); }
    if (!readyRef.current) return false;
    if (action === "play") { playerRef.current?.seekTo?.(currentTime || 0); playerRef.current?.playVideo?.(); setPlaying(true); }
    if (action === "pause") { playerRef.current?.seekTo?.(currentTime || 0); playerRef.current?.pauseVideo?.(); setPlaying(false); }
    if (action === "seek") playerRef.current?.seekTo?.(currentTime || 0);
    return true;
  }

  // Carrega a YouTube IFrame API uma vez
  useEffect(() => {
    if (window.YT?.Player) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }, []);

  function initPlayer(vid) {
    readyRef.current = false;
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }

    // Recria o div de montagem (YT API substitui o elemento)
    const container = document.getElementById("yt-music-container");
    if (!container) return;
    container.innerHTML = `<div id="${PLAYER_DIV_ID}"></div>`;

    playerRef.current = new window.YT.Player(PLAYER_DIV_ID, {
      videoId: vid,
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e) => {
          readyRef.current = true;
          e.target.setVolume(volumeRef.current);
          if (pendingUpdateRef.current) {
            applyMusicUpdate(pendingUpdateRef.current);
            pendingUpdateRef.current = null;
          }
        },
        onStateChange: (e) => {
          const S = window.YT.PlayerState;
          if (e.data === S.ENDED && loopRef.current) {
            playerRef.current?.seekTo(0);
            playerRef.current?.playVideo();
          }
          if (e.data === S.ENDED && !loopRef.current) setPlaying(false);
        },
      },
    });
  }

  // Cria/recria o player quando videoId muda
  useEffect(() => {
    if (!videoId) return;
    if (window.YT?.Player) {
      initPlayer(videoId);
    } else {
      window.onYouTubeIframeAPIReady = () => initPlayer(videoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Recebe atualizações dos outros participantes
  useEffect(() => {
    if (!socket) return;
    function onMusicUpdate(update) {
      const { videoId: vid } = update;
      if (vid && vid !== videoId) {
        pendingUpdateRef.current = update;
        setVideoId(vid);
        return;
      }
      if (!applyMusicUpdate(update)) pendingUpdateRef.current = update;
    }
    socket.on("music-update", onMusicUpdate);
    socket.emit("get-music-state");
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
    const t = playerRef.current?.getCurrentTime?.() || 0;
    playerRef.current?.pauseVideo?.();
    setPlaying(false);
    broadcast({ action: "pause", videoId, currentTime: t });
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
    <div className="side-panel music-panel" style={{ display: visible ? "flex" : "none" }}>
      <div className="side-panel-header">
        <h3><i className="bi bi-music-note-beamed" /> Música</h3>
        <button className="icon-btn" onClick={onClose}><i className="bi bi-x-lg" /></button>
      </div>

      <div className="music-body">
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
        {error && <div className="error-text" style={{ padding: "0 4px" }}>{error}</div>}

        {/* Container fixo — nunca removido do DOM */}
        <div
          id="yt-music-container"
          className="music-player-wrap"
          style={{ visibility: videoId ? "visible" : "hidden", height: videoId ? undefined : 0, padding: videoId ? undefined : 0 }}
        >
          <div id={PLAYER_DIV_ID} />
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
