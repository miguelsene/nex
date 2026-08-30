import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { checkRoomExists, fetchIceConfig } from "../services/api.js";
import { validateName, getInitials, buildInviteUrl } from "../utils/format.js";

import { useMediaDevices } from "../hooks/useMediaDevices.js";
import { useSocket } from "../hooks/useSocket.js";
import { useWebRTC } from "../hooks/useWebRTC.js";
import { useSpeakingDetector } from "../hooks/useSpeakingDetector.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { saveCallRecord, sendFriendRequest, getContacts } from "../services/social.js";

import VideoGrid from "../components/VideoGrid.jsx";
import CallControls from "../components/CallControls.jsx";
import ParticipantList from "../components/ParticipantList.jsx";
import Chat from "../components/Chat.jsx";
import InviteModal from "../components/InviteModal.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import MusicPlayer from "../components/MusicPlayer.jsx";
import NexLogo from "../components/NexLogo.jsx";
import ThemePicker from "../components/ThemePicker.jsx";

export default function Room({ activeCall, onStartCall }) {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [confirmedName, setConfirmedName] = useState(location.state?.name || null);

  if (!confirmedName) {
    return <JoinScreen roomId={roomId} onJoined={setConfirmedName} />;
  }

  if (onStartCall) {
    return (
      <StartPersistentCall
        activeCall={activeCall}
        roomId={roomId}
        name={confirmedName}
        onStartCall={onStartCall}
      />
    );
  }

  return <CallExperience roomId={roomId} name={confirmedName} />;
}

function StartPersistentCall({ activeCall, roomId, name, onStartCall }) {
  const normalizedRoomId = roomId.toUpperCase();

  useEffect(() => {
    if (activeCall?.roomId === normalizedRoomId) return;
    onStartCall({ roomId: normalizedRoomId, name, minimized: false });
  }, [activeCall?.roomId, name, normalizedRoomId, onStartCall]);

  if (activeCall?.roomId === normalizedRoomId) return null;

  return (
    <div className="full-screen-loader rpg-loader">
      <NexLogo size={76} />
      <div className="spinner" />
      <p>Abrindo chamada...</p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Tela de entrada (quando alguém abre o link de convite diretamente)     */
/* ---------------------------------------------------------------------- */

function JoinScreen({ roomId, onJoined }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);
  const [roomFound, setRoomFound] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    checkRoomExists(roomId.toUpperCase())
      .then(({ exists }) => {
        if (!cancelled) setRoomFound(exists);
      })
      .catch(() => {
        if (!cancelled) setRoomFound(true); // não bloqueia por falha de verificação
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  function handleSubmit(e) {
    e.preventDefault();
    const nameToUse = user ? user.name : name;
    const validationError = validateName(nameToUse);
    if (validationError) { setError(validationError); return; }
    onJoined(nameToUse.trim());
  }

  return (
    <div className="home">
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob b1" />
        <div className="aurora-blob b2" />
      </div>

      <div className="join-screen">
        <div className="join-card glass-card">
          <button className="btn-ghost-sm" onClick={() => navigate(-1)} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="bi bi-arrow-left" /> Voltar
          </button>
          <div className="room-badge">
            <i className="bi bi-camera-video-fill" /> Sala {roomId?.toUpperCase()}
          </div>

          {name.trim() && <div className="avatar-preview">{getInitials(name)}</div>}

          <h2>Você foi convidado para uma chamada</h2>
          <p>Digite seu nome para entrar.</p>

          {checking && <p>Verificando a sala...</p>}
          {!checking && !roomFound && (
            <p className="room-not-found">
              <i className="bi bi-exclamation-triangle-fill" /> Esta sala não existe mais ou já foi encerrada.
            </p>
          )}

          {(!checking && roomFound) && (
            <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
              {!user && (
                <div className="name-input-wrap">
                  <i className="bi bi-person" />
                  <input
                    type="text"
                    placeholder="Digite seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    autoFocus
                  />
                </div>
              )}
              {user && (
                <div className="name-input-wrap">
                  <i className="bi bi-person-check" />
                  <span style={{ flex: 1, padding: "14px 0", color: "var(--text-primary)" }}>{user.name}</span>
                </div>
              )}
              {error && <div className="error-text">{error}</div>}
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-box-arrow-in-right" /> Entrar na chamada
              </button>
            </form>
          )}

          {!checking && !roomFound && (
            <a href="/" className="btn btn-ghost">
              Criar uma nova sala
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Experiência da chamada em si                                          */
/* ---------------------------------------------------------------------- */

export function CallExperience({ roomId, name, minimized = false, onMinimizedChange, onEnded }) {
  const navigate = useNavigate();
  const normalizedRoomId = roomId.toUpperCase();
  const { user } = useAuth();
  const callStartRef = useRef(Date.now());

  const media = useMediaDevices();
  const { socket, connectionState } = useSocket();
  const [iceServers, setIceServers] = useState(null);

  const [activePanel, setActivePanel] = useState(null); // null | 'chat' | 'participants'
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speakerId, setSpeakerId] = useState(null);
  const controlBarRef = useRef(null);
  const [pinnedParticipantId, setPinnedParticipantId] = useState(null);
  const [participantVolumes, setParticipantVolumes] = useState({});
  const [participantMenu, setParticipantMenu] = useState(null);
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [hideUnpinned, setHideUnpinned] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [reactionBursts, setReactionBursts] = useState([]);
  const [callSettings, setCallSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("nexa_call_settings") || "null");
      return saved || { quality: "media", micVolume: 80, layout: "grid", themeMode: "dark", performanceMode: false };
    } catch {
      return { quality: "media", micVolume: 80, layout: "grid", themeMode: "dark", performanceMode: false };
    }
  });
  const toastIdRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useEffect(() => {
    setIsMinimized(minimized);
  }, [minimized]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = callSettings.themeMode;
    document.documentElement.dataset.performance = callSettings.performanceMode ? "on" : "off";
    localStorage.setItem("nexa_call_settings", JSON.stringify(callSettings));
  }, [callSettings]);

  useEffect(() => {
    media.setVideoQuality?.(callSettings.quality);
  }, [callSettings.quality, media]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCallDurationSeconds(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const formatDuration = useCallback((seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return [hrs, mins, secs].map((value) => String(value).padStart(2, "0")).join(":");
    return [mins, secs].map((value) => String(value).padStart(2, "0")).join(":");
  }, []);

  const handleQuickReaction = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    setReactionBursts((prev) => [...prev, { id, emoji, x: 45 + Math.random() * 10, y: 18 + Math.random() * 12 }]);
    pushToast(`${name} reagiu com ${emoji}`);
    window.setTimeout(() => {
      setReactionBursts((prev) => prev.filter((item) => item.id !== id));
    }, 1800);
  }, [name, pushToast]);

  const updateCallSetting = useCallback((key, value) => {
    setCallSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setMinimizedState = useCallback(
    (value) => {
      setIsMinimized(value);
      onMinimizedChange?.(value);
    },
    [onMinimizedChange]
  );

  useEffect(() => {
    fetchIceConfig()
      .then((cfg) => setIceServers(cfg.iceServers))
      .catch(() => setIceServers(null));
  }, []);

  const pushToast = useCallback((text) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const handleCallEvent = useCallback(
    (event) => {
      if (event.type === "joined") pushToast(`${event.name} entrou na chamada`);
      if (event.type === "left") pushToast(`${event.name} saiu da chamada`);
    },
    [pushToast]
  );

  const webrtc = useWebRTC({
    socket,
    roomId: normalizedRoomId,
    name,
    avatar: user?.avatar || null,
    userId: user?.id || null,
    localStream: media.localStream,
    iceServers,
    onEvent: handleCallEvent,
  });

  // Define a track de vídeo ativa assim que a câmera estiver pronta
  useEffect(() => {
    if (media.localStream) {
      const track = media.localStream.getVideoTracks()[0] || null;
      if (!media.isSharingScreen) webrtc.setActiveVideoTrack(track);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.localStream]);

  useSpeakingDetector(media.localStream, media.micOn, (isSpeaking) => {
    setLocalSpeaking(isSpeaking);
    webrtc.broadcastSpeaking(isSpeaking);
  });

  useEffect(() => {
    if (activePanel === "chat") setUnreadChat(0);
  }, [activePanel, webrtc.messages.length]);

  useEffect(() => {
    if (activePanel !== "chat" && webrtc.messages.length > 0) {
      setUnreadChat((prev) => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webrtc.messages.length]);

  useEffect(() => {
    if (!participantMenu) return;
    const closeMenu = () => setParticipantMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [participantMenu]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const targetTag = document.activeElement?.tagName;
      const isTypingField = targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT";
      if (isTypingField && !(event.ctrlKey || event.metaKey || event.altKey)) return;

      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        if (showInvite) setShowInvite(false);
        else if (showSettings) setShowSettings(false);
        else if (activePanel) setActivePanel(null);
        else if (participantMenu) setParticipantMenu(null);
        return;
      }

      if (key === "m") { event.preventDefault(); handleToggleMic(); }
      else if (key === "c") { event.preventDefault(); handleToggleCam(); }
      else if (key === "f" && pinnedParticipantId) { event.preventDefault(); setHideUnpinned((value) => !value); }
      else if (key === "i") { if (!showInvite) { event.preventDefault(); setShowInvite(true); } }
      else if (key === "s") { if (!showSettings) { event.preventDefault(); setShowSettings(true); } }
      else if (key === "t") { event.preventDefault(); togglePanel("chat"); }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, handleToggleCam, handleToggleMic, pinnedParticipantId, showInvite, showSettings, togglePanel]);

  useEffect(() => {
    if (!pinnedParticipantId || activePanel || participantMenu || showInvite || showSettings) {
      setHudVisible(true);
      return;
    }

    let hideTimer;
    const showHud = () => {
      setHudVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setHudVisible(false), 2200);
    };

    showHud();
    window.addEventListener("mousemove", showHud);
    window.addEventListener("touchstart", showHud);
    window.addEventListener("keydown", showHud);
    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener("mousemove", showHud);
      window.removeEventListener("touchstart", showHud);
      window.removeEventListener("keydown", showHud);
    };
  }, [pinnedParticipantId, activePanel, participantMenu, showInvite, showSettings]);

  function togglePanel(panel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  function togglePinnedParticipant(participantId) {
    setPinnedParticipantId((current) => (current === participantId ? null : participantId));
  }

  function minimizeCall() {
    setActivePanel(null);
    setParticipantMenu(null);
    setShowInvite(false);
    setShowSettings(false);
    setMinimizedState(true);
    pushToast("Chamada minimizada");
    sessionStorage.setItem("nexa_active_call", JSON.stringify({ roomId: normalizedRoomId, name, at: Date.now() }));
    navigate("/");
  }

  function restoreCall() {
    setMinimizedState(false);
    navigate(`/room/${normalizedRoomId}`, { state: { name } });
  }

  function handleOpenParticipantMenu({ event, participant }) {
    setParticipantMenu({
      participant,
      x: Math.min(event.clientX, window.innerWidth - 260),
      y: Math.min(event.clientY, window.innerHeight - 220),
    });
  }

  function handleParticipantVolume(participantId, value) {
    setParticipantVolumes((current) => ({ ...current, [participantId]: Number(value) }));
  }

  function openAppPage(path) {
    window.open(path, "_blank", "noopener,noreferrer");
  }

  async function handleToggleMic() {
    const nextMicOn = !media.micOn;
    const audioTrack = await media.toggleMic();
    if (audioTrack) {
      webrtc.replaceOutgoingTrack("audio", audioTrack);
    }
    if (!audioTrack) {
      pushToast("Não foi possível ativar o microfone.");
      return;
    }
    webrtc.broadcastMicState(nextMicOn);
    pushToast(nextMicOn ? "Microfone ligado" : "Microfone desligado");
  }

  function handleToggleCam() {
    media.toggleCam();
    webrtc.broadcastCamState(!media.camOn);
    pushToast(!media.camOn ? "Câmera ligada" : "Câmera desligada");
  }

  const handleToggleRecording = useCallback(() => {
    if (!window.MediaRecorder) {
      pushToast("Gravação não é suportada por este navegador.");
      return;
    }

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (!media.localStream) {
      pushToast("A câmera e o microfone ainda não estão prontos.");
      return;
    }

    const mimeType = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type));

    const recorder = new MediaRecorder(media.localStream, mimeType ? { mimeType } : undefined);
    recordedChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedChunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nexa-gravacao-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      pushToast("Gravação salva no seu dispositivo.");
    };

    recorder.start(250);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    pushToast("Gravação iniciada");
  }, [isRecording, media.localStream, pushToast]);

  async function handleToggleScreenShare() {
    if (media.isSharingScreen) {
      const cameraTrack = media.stopScreenShare();
      webrtc.setActiveVideoTrack(cameraTrack);
      webrtc.replaceOutgoingTrack("video", cameraTrack);
      webrtc.broadcastScreenShareStop();
    } else {
      const screenTrack = await media.startScreenShare();
      if (!screenTrack) return;
      webrtc.setActiveVideoTrack(screenTrack);
      webrtc.replaceOutgoingTrack("video", screenTrack);
      webrtc.broadcastScreenShareStart();
    }
  }

  async function handleSwitchCamera(deviceId) {
    const newTrack = await media.switchCamera(deviceId);
    if (newTrack && !media.isSharingScreen) {
      webrtc.setActiveVideoTrack(newTrack);
      webrtc.replaceOutgoingTrack("video", newTrack);
    }
    if (!newTrack) pushToast("Não foi possível trocar a câmera.");
  }

  async function handleSwitchMicrophone(deviceId) {
    const newTrack = await media.switchMicrophone(deviceId);
    if (newTrack) {
      webrtc.replaceOutgoingTrack("audio", newTrack);
      pushToast("Microfone alterado com sucesso.");
    } else {
      pushToast("Não foi possível trocar o microfone.");
    }
  }

  function handleLeave() {
    setConfirmLeave(true);
  }

  function handleLeaveConfirmed() {
    setConfirmLeave(false);
    const durationSeconds = Math.floor((Date.now() - callStartRef.current) / 1000);
    const participantNames = Array.from(webrtc.participants.values()).map((p) => p.name);
    if (user) {
      saveCallRecord(user.id, {
        roomId: normalizedRoomId,
        participants: participantNames,
        durationSeconds,
      });
    }
    sessionStorage.setItem("nexa_last_room", JSON.stringify({ roomId: normalizedRoomId, name, at: Date.now() }));
    socket.emit("leave-room");
    socket.disconnect();
    onEnded?.();
    pushToast("Você saiu da sala.");
    navigate("/");
  }

  function handleAddFriend(participant) {
    if (!user) { pushToast("Faça login para adicionar amigos."); return; }
    if (!participant.userId) { pushToast("Este participante não tem conta Nexa."); return; }
    const contacts = getContacts(user.id);
    if (contacts.find((c) => c.id === participant.userId)) { pushToast(`${participant.name} já é seu contato.`); return; }
    const result = sendFriendRequest(
      { id: user.id, name: user.name, avatar: user.avatar || null },
      participant.userId
    );
    if (result.ok) pushToast(`Pedido enviado para ${participant.name}!`);
    else pushToast(result.error || "Erro ao enviar pedido.");
  }

  const remoteParticipants = useMemo(() => Array.from(webrtc.participants.values()), [webrtc.participants]);

  const selfForGrid = useMemo(
    () => ({
      id: "self",
      name: `${name}`,
      avatar: user?.avatar || null,
      isLocal: true,
      stream: media.localStream,
      micOn: media.micOn,
      camOn: media.camOn,
      isSharingScreen: media.isSharingScreen,
      speaking: localSpeaking,
    }),
    [name, user, media.localStream, media.micOn, media.camOn, media.isSharingScreen, localSpeaking]
  );

  const inviteUrl = buildInviteUrl(normalizedRoomId);

  // --- Estados de carregamento / erro de mídia ---
  if (media.status === "requesting") {
    return (
      <div className="full-screen-loader rpg-loader">
        <NexLogo size={76} />
        <div className="spinner" />
        <p>Solicitando acesso à câmera e ao microfone...</p>
      </div>
    );
  }

  if (media.status === "error") {
    return (
      <div className="full-screen-loader rpg-loader">
        <NexLogo size={76} />
        <div className="error-banner">
          <i className="bi bi-exclamation-triangle-fill" />
          {media.errorMessage}
        </div>
        <a href="/" className="btn btn-ghost">
          Voltar para o início
        </a>
      </div>
    );
  }

  if (!webrtc.joined && !webrtc.joinError) {
    return (
      <div className="full-screen-loader rpg-loader">
        <NexLogo size={76} />
        <div className="spinner" />
        <p>Conectando à sala {normalizedRoomId}...</p>
      </div>
    );
  }

  if (webrtc.joinError) {
    return (
      <div className="full-screen-loader rpg-loader">
        <NexLogo size={76} />
        <div className="error-banner">
          <i className="bi bi-exclamation-triangle-fill" />
          {webrtc.joinError}
        </div>
        <a href="/" className="btn btn-ghost">
          Voltar para o início
        </a>
      </div>
    );
  }

  return (
    <>
      <a href="#call-controls" className="sr-only" onClick={(event) => { event.preventDefault(); controlBarRef.current?.focus(); }}>
        Pular para os controles da chamada
      </a>

      <div
        className={[
          "room",
          isMinimized ? "is-minimized" : "",
          pinnedParticipantId && !hudVisible ? "hud-hidden" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-theme={callSettings.themeMode}
        data-layout={callSettings.layout}
        data-performance={callSettings.performanceMode ? "on" : "off"}
      >
      <div className="room-topbar">
        <div className="brand">
          <span className="brand-mark">
            <NexLogo size={18} />
          </span>
          <span className="brand-text">Nex</span>
        </div>

        <div className="room-meta">
          <button type="button" className="topbar-icon-btn" data-tooltip="Início" aria-label="Voltar para a página inicial" onClick={() => openAppPage("/")}>
            <i className="bi bi-house-fill" />
          </button>
          <button type="button" className="topbar-icon-btn" data-tooltip="Painel" aria-label="Abrir painel" onClick={() => openAppPage("/dashboard")}>
            <i className="bi bi-grid-fill" />
          </button>
          <button type="button" className="topbar-icon-btn" data-tooltip="Servidores" aria-label="Abrir servidores" onClick={() => openAppPage("/servers")}>
            <i className="bi bi-server" />
          </button>
          <ThemePicker />
          <div className="room-code-pill">
            <i className="bi bi-hash" />
            <span className="code-label">Sala</span> {normalizedRoomId}
          </div>
          <div className="room-code-pill timer-pill" aria-live="polite">
            <i className="bi bi-clock-history" />
            <span>{formatDuration(callDurationSeconds)}</span>
          </div>
          <div className={`connection-pill ${connectionState}`}>
            <span className="dot" />
            {connectionState === "connected" && "Conectado"}
            {connectionState === "connecting" && "Conectando..."}
            {connectionState === "lost" && "Reconectando..."}
          </div>
        </div>
      </div>

      <div className="event-toasts" role="status" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className="event-toast glass-card">
            {t.text}
          </div>
        ))}
      </div>

      <div className="reaction-layer" aria-live="polite" aria-atomic="true">
        {reactionBursts.map((reaction) => (
          <div
            key={reaction.id}
            className="reaction-burst"
            style={{ left: `${reaction.x}%`, top: `${reaction.y}%` }}
          >
            {reaction.emoji}
          </div>
        ))}
      </div>

      {connectionState === "lost" && (
        <div className="reconnect-banner">
          <span className="spinner" />
          Conexão perdida. Tentando reconectar...
        </div>
      )}

      <div className="room-body">
        <div className="stage">
          {remoteParticipants.length === 0 ? (
            <div className="waiting-state">
              <div className="pulse-ring">
                <i className="bi bi-person-plus-fill" style={{ fontSize: "1.6rem" }} />
              </div>
              <h3>Aguardando outros participantes</h3>
              <p>Compartilhe o link do convite para começar a chamada.</p>
              <button type="button" className="btn btn-primary" onClick={() => setShowInvite(true)}>
                <i className="bi bi-link-45deg" /> Copiar link do convite
              </button>
              <div style={{ maxWidth: 340, width: "100%" }}>
                <VideoGrid
                  self={selfForGrid}
                  remoteParticipants={[]}
                  speakerId={speakerId}
                  pinnedId={pinnedParticipantId}
                  hideUnpinned={hideUnpinned}
                  participantVolumes={participantVolumes}
                  onTogglePin={togglePinnedParticipant}
                  onToggleFocus={() => setHideUnpinned((value) => !value)}
                  onOpenParticipantMenu={handleOpenParticipantMenu}
                />
              </div>
            </div>
          ) : (
            <VideoGrid
              self={selfForGrid}
              remoteParticipants={remoteParticipants}
              speakerId={speakerId}
              pinnedId={pinnedParticipantId}
              hideUnpinned={hideUnpinned}
              participantVolumes={participantVolumes}
              onTogglePin={togglePinnedParticipant}
              onToggleFocus={() => setHideUnpinned((value) => !value)}
              onOpenParticipantMenu={handleOpenParticipantMenu}
            />
          )}
        </div>

        {activePanel === "participants" && (
          <ParticipantList
            self={selfForGrid}
            remoteParticipants={remoteParticipants}
            onClose={() => setActivePanel(null)}
            onAddFriend={user ? handleAddFriend : null}
          />
        )}

        {activePanel === "chat" && (
          <Chat
            messages={webrtc.messages}
            selfId={webrtc.selfId}
            onSend={webrtc.sendChatMessage}
            onClose={() => setActivePanel(null)}
          />
        )}

        <MusicPlayer
          socket={socket}
          isHost={remoteParticipants.length === 0 || webrtc.selfId === Array.from(webrtc.participants.keys())[0]}
          onClose={() => setActivePanel(null)}
          visible={activePanel === "music"}
        />
      </div>

      <CallControls
        micOn={media.micOn}
        camOn={media.camOn}
        isSharingScreen={media.isSharingScreen}
        activePanel={activePanel}
        participantCount={remoteParticipants.length + 1}
        unreadChatCount={unreadChat}
        focusMode={hideUnpinned && Boolean(pinnedParticipantId)}
        isRecording={isRecording}
        controlBarRef={controlBarRef}
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onToggleScreenShare={handleToggleScreenShare}
        onTogglePanel={togglePanel}
        onOpenInvite={() => setShowInvite(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleFocusMode={() => pinnedParticipantId && setHideUnpinned((value) => !value)}
        onToggleRecording={handleToggleRecording}
        onQuickReaction={handleQuickReaction}
        onMinimize={minimizeCall}
        onLeave={handleLeave}
      />

      {isMinimized && (
        <div className="mini-call glass-card">
          <div className="mini-call-info">
            <i className="bi bi-camera-video-fill" />
            <div>
              <strong>Sala {normalizedRoomId}</strong>
              <span>{remoteParticipants.length + 1} na chamada · {formatDuration(callDurationSeconds)}</span>
            </div>
          </div>
          <div className="mini-call-actions">
            <button type="button" className="icon-btn" data-tooltip="InÃ­cio" onClick={() => openAppPage("/")}>
              <i className="bi bi-house-fill" />
            </button>
            <button type="button" className="icon-btn" data-tooltip="Painel" onClick={() => openAppPage("/dashboard")}>
              <i className="bi bi-grid-fill" />
            </button>
            <button type="button" className="icon-btn" data-tooltip="Restaurar" onClick={restoreCall}>
              <i className="bi bi-arrows-fullscreen" />
            </button>
            <button type="button" className="icon-btn danger" data-tooltip="Sair" onClick={handleLeave}>
              <i className="bi bi-telephone-x-fill" />
            </button>
          </div>
        </div>
      )}

      {participantMenu && (
        <div
          className="participant-context-menu glass-card"
          style={{ left: participantMenu.x, top: participantMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="context-title">
            <strong>{participantMenu.participant.name}</strong>
            <button type="button" className="icon-btn" onClick={() => setParticipantMenu(null)}>
              <i className="bi bi-x" />
            </button>
          </div>
          <button type="button" onClick={() => togglePinnedParticipant(participantMenu.participant.id)}>
            <i className="bi bi-arrows-fullscreen" />
            {pinnedParticipantId === participantMenu.participant.id ? "Restaurar grade" : "Maximizar tela"}
          </button>
          {pinnedParticipantId === participantMenu.participant.id && (
            <button type="button" onClick={() => setHideUnpinned((value) => !value)}>
              <i className="bi bi-person-video2" />
              {hideUnpinned ? "Mostrar participantes" : "Ocultar participantes"}
            </button>
          )}
          <label className={participantMenu.participant.isLocal ? "disabled" : ""}>
            <span>
              <i className="bi bi-volume-up-fill" /> Volume
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={participantVolumes[participantMenu.participant.id] ?? 1}
              disabled={participantMenu.participant.isLocal}
              onChange={(event) => handleParticipantVolume(participantMenu.participant.id, event.target.value)}
            />
          </label>
          {participantMenu.participant.isLocal && <small>Seu prÃ³prio Ã¡udio fica silenciado localmente para evitar eco.</small>}
        </div>
      )}

      {showInvite && (
        <InviteModal
          inviteUrl={inviteUrl}
          roomId={normalizedRoomId}
          onClose={() => setShowInvite(false)}
          onCopySuccess={() => pushToast("Convite copiado!")}
        />
      )}

      {showSettings && (
        <SettingsModal
          devices={media.devices}
          localStream={media.localStream}
          settings={callSettings}
          onSettingChange={updateCallSetting}
          onSwitchCamera={handleSwitchCamera}
          onSwitchMicrophone={handleSwitchMicrophone}
          onSpeakerChange={setSpeakerId}
          onClose={() => setShowSettings(false)}
        />
      )}

      {confirmLeave && (
        <div className="modal-overlay" onClick={() => setConfirmLeave(false)}>
          <div className="modal-card glass-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Sair da sala</h3>
              <button type="button" className="icon-btn" onClick={() => setConfirmLeave(false)} aria-label="Fechar mensagem">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="leave-summary">
              <div>
                <span>Participantes</span>
                <strong>{remoteParticipants.length + 1}</strong>
              </div>
              <div>
                <span>Duração</span>
                <strong>{formatDuration(callDurationSeconds)}</strong>
              </div>
            </div>
            <p>Tem certeza que deseja encerrar a chamada?</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmLeave(false)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={handleLeaveConfirmed}>Sair</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
