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

export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [confirmedName, setConfirmedName] = useState(location.state?.name || null);

  if (!confirmedName) {
    return <JoinScreen roomId={roomId} onJoined={setConfirmedName} />;
  }

  return <CallExperience roomId={roomId} name={confirmedName} />;
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

function CallExperience({ roomId, name }) {
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
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const toastIdRef = useRef(0);

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

  function togglePanel(panel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  function handleToggleMic() {
    media.toggleMic();
    webrtc.broadcastMicState(!media.micOn);
  }

  function handleToggleCam() {
    media.toggleCam();
    webrtc.broadcastCamState(!media.camOn);
  }

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
  }

  async function handleSwitchMicrophone(deviceId) {
    const newTrack = await media.switchMicrophone(deviceId);
    if (newTrack) {
      webrtc.replaceOutgoingTrack("audio", newTrack);
    }
  }

  function handleLeave() {
    const durationSeconds = Math.floor((Date.now() - callStartRef.current) / 1000);
    const participantNames = Array.from(webrtc.participants.values()).map((p) => p.name);
    if (user) {
      saveCallRecord(user.id, {
        roomId: normalizedRoomId,
        participants: participantNames,
        durationSeconds,
      });
    }
    // Guarda sala ativa para poder voltar
    sessionStorage.setItem("nexa_last_room", JSON.stringify({ roomId: normalizedRoomId, name, at: Date.now() }));
    socket.emit("leave-room");
    socket.disconnect();
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
      <div className="full-screen-loader">
        <div className="spinner" />
        <p>Solicitando acesso à câmera e ao microfone...</p>
      </div>
    );
  }

  if (media.status === "error") {
    return (
      <div className="full-screen-loader">
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
      <div className="full-screen-loader">
        <div className="spinner" />
        <p>Conectando à sala {normalizedRoomId}...</p>
      </div>
    );
  }

  if (webrtc.joinError) {
    return (
      <div className="full-screen-loader">
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
    <div className="room">
      <div className="room-topbar">
        <div className="brand">
          <span className="brand-mark">
            <NexLogo size={18} />
          </span>
          <span className="brand-text">Nex</span>
        </div>

        <div className="room-meta">
          <ThemePicker />
          <div className="room-code-pill">
            <i className="bi bi-hash" />
            <span className="code-label">Sala</span> {normalizedRoomId}
          </div>
          <div className={`connection-pill ${connectionState}`}>
            <span className="dot" />
            {connectionState === "connected" && "Conectado"}
            {connectionState === "connecting" && "Conectando..."}
            {connectionState === "lost" && "Reconectando..."}
          </div>
        </div>
      </div>

      <div className="event-toasts">
        {toasts.map((t) => (
          <div key={t.id} className="event-toast glass-card">
            {t.text}
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
                <VideoGrid self={selfForGrid} remoteParticipants={[]} speakerId={speakerId} />
              </div>
            </div>
          ) : (
            <VideoGrid self={selfForGrid} remoteParticipants={remoteParticipants} speakerId={speakerId} />
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
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onToggleScreenShare={handleToggleScreenShare}
        onTogglePanel={togglePanel}
        onOpenInvite={() => setShowInvite(true)}
        onOpenSettings={() => setShowSettings(true)}
        onLeave={handleLeave}
      />

      {showInvite && (
        <InviteModal inviteUrl={inviteUrl} roomId={normalizedRoomId} onClose={() => setShowInvite(false)} />
      )}

      {showSettings && (
        <SettingsModal
          devices={media.devices}
          localStream={media.localStream}
          onSwitchCamera={handleSwitchCamera}
          onSwitchMicrophone={handleSwitchMicrophone}
          onSpeakerChange={setSpeakerId}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
