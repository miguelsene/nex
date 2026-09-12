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
import { resetSocket } from "../services/socket.js";

import VideoGrid from "../components/VideoGrid.jsx";
import CallControls from "../components/CallControls.jsx";
import ParticipantList from "../components/ParticipantList.jsx";
import Chat from "../components/Chat.jsx";
import InviteModal from "../components/InviteModal.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import MusicPlayer from "../components/MusicPlayer.jsx";
import NexLogo from "../components/NexLogo.jsx";
import ThemePicker from "../components/ThemePicker.jsx";

export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const [confirmedName, setConfirmedName] = useState(location.state?.name || null);
  const [mediaPrefs, setMediaPrefs] = useState(location.state?.mediaPrefs || null);

  function handleJoined(name, prefs) {
    setMediaPrefs(prefs || { withMic: false, withCam: false });
    setConfirmedName(name);
  }

  if (!confirmedName) return <JoinScreen roomId={roomId} onJoined={handleJoined} />;
  return <CallExperience roomId={roomId} name={confirmedName} mediaPrefs={mediaPrefs} />;
}

function JoinScreen({ roomId, onJoined }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);
  const [roomFound, setRoomFound] = useState(true);
  const [confirmedEntry, setConfirmedEntry] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    checkRoomExists(roomId.toUpperCase())
      .then(({ exists }) => { if (!cancelled) setRoomFound(exists); })
      .catch(() => { if (!cancelled) setRoomFound(true); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [roomId]);

  function handleSubmit(e) {
    e.preventDefault();
    const nameToUse = user ? user.name : name;
    const validationError = validateName(nameToUse);
    if (validationError) { setError(validationError); return; }
    setConfirmedEntry({ name: nameToUse.trim() });
  }

  if (confirmedEntry) return <PreCallScreen name={confirmedEntry.name} onJoined={onJoined} />;

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
          {!checking && roomFound && (
            <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
              {!user && (
                <div className="name-input-wrap">
                  <i className="bi bi-person" />
                  <input type="text" placeholder="Digite seu nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
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
            <a href="/" className="btn btn-ghost">Criar uma nova sala</a>
          )}
        </div>
      </div>
    </div>
  );
}

function PreCallScreen({ name, onJoined }) {
  const [withMic, setWithMic] = useState(false);
  const [withCam, setWithCam] = useState(false);

  return (
    <div className="home">
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob b1" />
        <div className="aurora-blob b2" />
      </div>
      <div className="join-screen">
        <div className="join-card glass-card">
          <div className="room-badge">
            <i className="bi bi-camera-video-fill" /> Pronto para entrar?
          </div>
          <h2 style={{ textAlign: "center" }}>Olá, {name}!</h2>
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Escolha como deseja entrar na chamada.</p>
          <div className="precall-options">
            <button type="button" className={`precall-toggle ${withMic ? "active" : ""}`} onClick={() => setWithMic((v) => !v)}>
              <i className={`bi ${withMic ? "bi-mic-fill" : "bi-mic-mute-fill"}`} />
              <span>{withMic ? "Microfone ligado" : "Microfone desligado"}</span>
            </button>
            <button type="button" className={`precall-toggle ${withCam ? "active" : ""}`} onClick={() => setWithCam((v) => !v)}>
              <i className={`bi ${withCam ? "bi-camera-video-fill" : "bi-camera-video-off-fill"}`} />
              <span>{withCam ? "Câmera ligada" : "Câmera desligada"}</span>
            </button>
          </div>
          <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => onJoined(name, { withMic, withCam })}>
            <i className="bi bi-box-arrow-in-right" /> Entrar na chamada
          </button>
        </div>
      </div>
    </div>
  );
}

export function CallExperience({ roomId, name, minimized = false, mediaPrefs, onMinimizedChange, onEnded }) {
  const navigate = useNavigate();
  const normalizedRoomId = roomId.toUpperCase();
  const { user } = useAuth();
  const callStartRef = useRef(Date.now());

  const media = useMediaDevices();
  const { socket, connectionState } = useSocket();
  const [iceServers, setIceServers] = useState([{ urls: "stun:stun.l.google.com:19302" }]);

  const [activePanel, setActivePanel] = useState(null);
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
      return JSON.parse(localStorage.getItem("nexa_call_settings") || "null") ||
        { quality: "media", micVolume: 80, layout: "grid", themeMode: "dark", performanceMode: false };
    } catch {
      return { quality: "media", micVolume: 80, layout: "grid", themeMode: "dark", performanceMode: false };
    }
  });
  const toastIdRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useEffect(() => { setIsMinimized(minimized); }, [minimized]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = callSettings.themeMode;
    document.documentElement.dataset.performance = callSettings.performanceMode ? "on" : "off";
    localStorage.setItem("nexa_call_settings", JSON.stringify(callSettings));
  }, [callSettings]);

  useEffect(() => { media.setVideoQuality?.(callSettings.quality); }, [callSettings.quality, media]);

  useEffect(() => {
    const id = window.setInterval(() => setCallDurationSeconds(Math.floor((Date.now() - callStartRef.current) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    fetchIceConfig()
      .then((cfg) => setIceServers(cfg.iceServers))
      .catch(() => {});
  }, []);

  const formatDuration = useCallback((s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
    return [m, sec].map((v) => String(v).padStart(2, "0")).join(":");
  }, []);

  const pushToast = useCallback((text) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const playSound = useCallback((type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (type === "join") {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(780, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.28);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
      } else {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(320, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.32);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.32);
      }
      osc.onended = () => ctx.close();
    } catch {}
  }, []);

  const handleCallEvent = useCallback((event) => {
    if (event.type === "joined") { pushToast(`${event.name} entrou na chamada`); playSound("join"); }
    if (event.type === "left") { pushToast(`${event.name} saiu da chamada`); playSound("leave"); }
  }, [pushToast, playSound]);

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

  // Aplica prefs de mic/cam da tela de pré-entrada
  const mediaPrefsAppliedRef = useRef(false);
  useEffect(() => {
    if (!media.localStream || mediaPrefsAppliedRef.current) return;
    mediaPrefsAppliedRef.current = true;
    const audioTrack = media.localStream.getAudioTracks()[0];
    const videoTrack = media.localStream.getVideoTracks()[0];
    if (audioTrack && audioTrack.enabled !== (mediaPrefs?.withMic ?? false)) media.toggleMic();
    if (videoTrack && videoTrack.enabled !== (mediaPrefs?.withCam ?? false)) media.toggleCam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.localStream]);

  useSpeakingDetector(media.localStream, media.micOn, (isSpeaking) => {
    setLocalSpeaking(isSpeaking);
    webrtc.broadcastSpeaking(isSpeaking);
  });

  useEffect(() => { if (activePanel === "chat") setUnreadChat(0); }, [activePanel, webrtc.messages.length]);
  useEffect(() => {
    if (activePanel !== "chat" && webrtc.messages.length > 0) setUnreadChat((p) => p + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webrtc.messages.length]);

  useEffect(() => {
    if (!participantMenu) return;
    const close = () => setParticipantMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("click", close); window.removeEventListener("resize", close); };
  }, [participantMenu]);

  useEffect(() => {
    if (!pinnedParticipantId || activePanel || participantMenu || showInvite || showSettings) {
      setHudVisible(true); return;
    }
    let timer;
    const show = () => { setHudVisible(true); clearTimeout(timer); timer = setTimeout(() => setHudVisible(false), 2200); };
    show();
    window.addEventListener("mousemove", show);
    window.addEventListener("touchstart", show);
    window.addEventListener("keydown", show);
    return () => { clearTimeout(timer); window.removeEventListener("mousemove", show); window.removeEventListener("touchstart", show); window.removeEventListener("keydown", show); };
  }, [pinnedParticipantId, activePanel, participantMenu, showInvite, showSettings]);

  function togglePanel(panel) { setActivePanel((p) => (p === panel ? null : panel)); }
  function togglePinnedParticipant(id) { setPinnedParticipantId((c) => (c === id ? null : id)); }
  function openAppPage(path) { window.open(path, "_blank", "noopener,noreferrer"); }

  function minimizeCall() {
    setActivePanel(null); setParticipantMenu(null); setShowInvite(false); setShowSettings(false);
    pushToast("Chamada minimizada");
    sessionStorage.setItem("nexa_active_call", JSON.stringify({ roomId: normalizedRoomId, name, at: Date.now() }));
    navigate("/");
  }

  function restoreCall() {
    setIsMinimized(false); onMinimizedChange?.(false);
    navigate(`/room/${normalizedRoomId}`, { state: { name } });
  }

  // --- Handlers de mídia ---
  async function handleToggleMic() {
    const next = !media.micOn;
    const track = await media.toggleMic();
    // toggleMic retorna a track existente com enabled alterado — só precisa broadcast
    if (track === null) { pushToast("Não foi possível ativar o microfone."); return; }
    webrtc.broadcastMicState(next);
    pushToast(next ? "Microfone ligado" : "Microfone desligado");
  }

  function handleToggleCam() {
    const next = !media.camOn;
    media.toggleCam();
    webrtc.broadcastCamState(next);
    pushToast(next ? "Câmera ligada" : "Câmera desligada");
  }

  async function handleToggleScreenShare() {
    if (media.isSharingScreen) {
      // Pega a track de câmera ANTES de parar o screen share
      const camTrack = media.localStream?.getVideoTracks()[0] || null;
      media.stopScreenShare();
      await webrtc.replaceOutgoingTrack("video", camTrack);
      webrtc.broadcastScreenShareStop();
    } else {
      const screenStream = await media.startScreenShare();
      if (!screenStream) return;
      const screenTrack = screenStream.getVideoTracks()[0];
      await webrtc.replaceOutgoingTrack("video", screenTrack);
      webrtc.broadcastScreenShareStart();
      screenTrack.addEventListener("ended", async () => {
        const camTrack = media.localStream?.getVideoTracks()[0] || null;
        await webrtc.replaceOutgoingTrack("video", camTrack);
        webrtc.broadcastScreenShareStop();
      }, { once: true });
    }
  }

  async function handleSwitchCamera(deviceId) {
    const newTrack = await media.switchCamera(deviceId);
    if (newTrack && !media.isSharingScreen) await webrtc.replaceOutgoingTrack("video", newTrack);
    if (!newTrack) pushToast("Não foi possível trocar a câmera.");
  }

  async function handleSwitchMicrophone(deviceId) {
    const newTrack = await media.switchMicrophone(deviceId);
    if (newTrack) { await webrtc.replaceOutgoingTrack("audio", newTrack); pushToast("Microfone alterado."); }
    else pushToast("Não foi possível trocar o microfone.");
  }

  const handleToggleRecording = useCallback(() => {
    if (!window.MediaRecorder) { pushToast("Gravação não suportada neste navegador."); return; }
    if (isRecording && mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); return; }
    if (!media.localStream) { pushToast("Mídia ainda não está pronta."); return; }
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(media.localStream, mimeType ? { mimeType } : undefined);
    recordedChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `nexa-gravacao-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      pushToast("Gravação salva.");
    };
    recorder.start(250); mediaRecorderRef.current = recorder; setIsRecording(true); pushToast("Gravação iniciada");
  }, [isRecording, media.localStream, pushToast]);

  const handleQuickReaction = useCallback((type) => {
    const icons = { like: "bi-hand-thumbs-up-fill", heart: "bi-heart-fill", clap: "bi-stars" };
    const id = Date.now() + Math.random();
    setReactionBursts((p) => [...p, { id, icon: icons[type] || "bi-star-fill", x: 45 + Math.random() * 10, y: 18 + Math.random() * 12 }]);
    pushToast(`${name} reagiu`);
    setTimeout(() => setReactionBursts((p) => p.filter((r) => r.id !== id)), 1800);
  }, [name, pushToast]);

  function handleLeave() { setConfirmLeave(true); }

  function handleLeaveConfirmed() {
    setConfirmLeave(false);
    const dur = Math.floor((Date.now() - callStartRef.current) / 1000);
    if (user) saveCallRecord(user.id, { roomId: normalizedRoomId, participants: Array.from(webrtc.participants.values()).map((p) => p.name), durationSeconds: dur });
    sessionStorage.setItem("nexa_last_room", JSON.stringify({ roomId: normalizedRoomId, name, at: Date.now() }));
    socket.emit("leave-room");
    onEnded?.();
    resetSocket();
    navigate("/");
  }

  function handleAddFriend(participant) {
    if (!user) { pushToast("Faça login para adicionar amigos."); return; }
    if (!participant.userId) { pushToast("Este participante não tem conta Nexa."); return; }
    const contacts = getContacts(user.id);
    if (contacts.find((c) => c.id === participant.userId)) { pushToast(`${participant.name} já é seu contato.`); return; }
    const result = sendFriendRequest({ id: user.id, name: user.name, avatar: user.avatar || null }, participant.userId);
    if (result.ok) pushToast(`Pedido enviado para ${participant.name}!`);
    else pushToast(result.error || "Erro ao enviar pedido.");
  }

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if ((tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") && !(e.ctrlKey || e.metaKey || e.altKey)) return;
      const k = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (showInvite) setShowInvite(false);
        else if (showSettings) setShowSettings(false);
        else if (activePanel) setActivePanel(null);
        else if (participantMenu) setParticipantMenu(null);
        return;
      }
      if (k === "m") { e.preventDefault(); handleToggleMic(); }
      else if (k === "c") { e.preventDefault(); handleToggleCam(); }
      else if (k === "f" && pinnedParticipantId) { e.preventDefault(); setHideUnpinned((v) => !v); }
      else if (k === "i" && !showInvite) { e.preventDefault(); setShowInvite(true); }
      else if (k === "s" && !showSettings) { e.preventDefault(); setShowSettings(true); }
      else if (k === "t") { e.preventDefault(); togglePanel("chat"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, pinnedParticipantId, showInvite, showSettings, participantMenu]);
