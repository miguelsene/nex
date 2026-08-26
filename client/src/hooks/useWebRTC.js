import { useCallback, useEffect, useRef, useState } from "react";
import { createPeerConnection, optimizeAudioSdp } from "../services/webrtc.js";

/**
 * Orquestra toda a chamada: entra na sala via Socket.IO, cria uma
 * RTCPeerConnection por participante remoto, troca offer/answer/ICE,
 * e mantém o estado de streams remotas, chat e presença.
 *
 * Estratégia para evitar "glare" (duas ofertas simultâneas):
 * quem ACABOU de entrar é sempre quem inicia a offer para os participantes
 * que já estavam na sala. Quem já estava na sala apenas responde.
 */
export function useWebRTC({ socket, roomId, name, avatar, userId, localStream, iceServers, onEvent }) {
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [participants, setParticipants] = useState(new Map());
  const [messages, setMessages] = useState([]);

  const peerConnections = useRef(new Map()); // remoteId -> RTCPeerConnection
  const pendingCandidates = useRef(new Map()); // remoteId -> RTCIceCandidateInit[]
  const localStreamRef = useRef(localStream);
  const iceServersRef = useRef(iceServers);
  const participantsRef = useRef(participants);
  const activeVideoTrackRef = useRef(null); // câmera OU tela — o que deve ser enviado agora

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    iceServersRef.current = iceServers;
  }, [iceServers]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const updateParticipant = useCallback((id, patch) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const current = next.get(id) || { id, name: "Convidado", avatar: null, userId: null, micOn: true, camOn: true, isSharingScreen: false, stream: null, speaking: false };
      next.set(id, { ...current, ...patch });
      return next;
    });
  }, []);

  const removeParticipant = useCallback((id) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const attachLocalTracks = useCallback((pc) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const existingKinds = new Set(pc.getSenders().map((s) => s.track?.kind).filter(Boolean));

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack && !existingKinds.has("audio")) {
      pc.addTrack(audioTrack, stream);
    }

    // Usa a track de vídeo ativa (câmera ou compartilhamento de tela em andamento)
    const videoTrack = activeVideoTrackRef.current || stream.getVideoTracks()[0];
    if (videoTrack && !existingKinds.has("video")) {
      pc.addTrack(videoTrack, stream);
    }
  }, []);

  /** Define qual track de vídeo deve ser enviada a partir de agora (câmera ou tela) */
  const setActiveVideoTrack = useCallback((track) => {
    activeVideoTrackRef.current = track;
  }, []);

  const flushPendingCandidates = useCallback(async (remoteId, pc) => {
    const queued = pendingCandidates.current.get(remoteId);
    if (!queued || queued.length === 0) return;
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignora candidatos inválidos/atrasados
      }
    }
    pendingCandidates.current.delete(remoteId);
  }, []);

  const getOrCreatePeerConnection = useCallback(
    (remoteId, remoteMeta) => {
      let pc = peerConnections.current.get(remoteId);
      if (pc) return pc;

      pc = createPeerConnection(iceServersRef.current, {
        onIceCandidate: (candidate) => {
          socket.emit("ice-candidate", { to: remoteId, candidate });
        },
        onTrack: (event) => {
          const [stream] = event.streams;
          updateParticipant(remoteId, { stream });
        },
        onConnectionStateChange: (state) => {
          if (state === "failed" || state === "closed") {
            updateParticipant(remoteId, { connectionLost: state === "failed" });
          }
        },
      });

      peerConnections.current.set(remoteId, pc);
      updateParticipant(remoteId, {
        id: remoteId,
        name: remoteMeta?.name || "Convidado",
        avatar: remoteMeta?.avatar || null,
        userId: remoteMeta?.userId || null,
        micOn: remoteMeta?.micOn ?? true,
        camOn: remoteMeta?.camOn ?? true,
        isSharingScreen: remoteMeta?.isSharingScreen ?? false,
      });

      return pc;
    },
    [socket, updateParticipant]
  );

  const closePeerConnection = useCallback((remoteId) => {
    const pc = peerConnections.current.get(remoteId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(remoteId);
    }
    pendingCandidates.current.delete(remoteId);
  }, []);

  const createOfferTo = useCallback(
    async (remoteId, remoteMeta) => {
      const pc = getOrCreatePeerConnection(remoteId, remoteMeta);
      attachLocalTracks(pc);
      try {
        const offer = await pc.createOffer();
        const optimized = new RTCSessionDescription({ type: offer.type, sdp: optimizeAudioSdp(offer.sdp) });
        await pc.setLocalDescription(optimized);
        socket.emit("offer", { to: remoteId, offer: pc.localDescription });
      } catch {
        // Falha ao negociar com este participante — não derruba a chamada inteira
      }
    },
    [attachLocalTracks, getOrCreatePeerConnection, socket]
  );

  // --- Entra na sala assim que socket e mídia local estiverem prontos ---
  useEffect(() => {
    if (!socket || !roomId || !name || !localStream) return;
    let cancelled = false;

    socket.emit("join-room", { roomId, name, avatar, userId }, async (response) => {
      if (cancelled) return;
      if (!response?.ok) {
        setJoinError(response?.error || "Não foi possível entrar na sala.");
        return;
      }

      setSelfId(response.self.id);
      setJoined(true);

      // Cria conexões e envia offers para quem já estava na sala
      for (const participant of response.participants) {
        await createOfferTo(participant.id, participant);
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId, name, localStream]);

  // --- Listeners de sinalização e presença ---
  useEffect(() => {
    if (!socket) return;

    function handleUserJoined({ participant }) {
      updateParticipant(participant.id, participant);
      onEvent?.({ type: "joined", name: participant.name });
    }

    function handleUserLeft({ id }) {
      const leaving = participantsRef.current.get(id);
      closePeerConnection(id);
      removeParticipant(id);
      if (leaving) onEvent?.({ type: "left", name: leaving.name });
    }

    async function handleOffer({ from, offer }) {
      const pc = getOrCreatePeerConnection(from);
      attachLocalTracks(pc);
      try {
        await pc.setRemoteDescription(offer);
        await flushPendingCandidates(from, pc);
        const answer = await pc.createAnswer();
        const optimized = new RTCSessionDescription({ type: answer.type, sdp: optimizeAudioSdp(answer.sdp) });
        await pc.setLocalDescription(optimized);
        socket.emit("answer", { to: from, answer: pc.localDescription });
      } catch {
        // Ignora falha de negociação pontual
      }
    }

    async function handleAnswer({ from, answer }) {
      const pc = peerConnections.current.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(answer);
        await flushPendingCandidates(from, pc);
      } catch {
        // Ignora
      }
    }

    async function handleIceCandidate({ from, candidate }) {
      const pc = peerConnections.current.get(from);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Ignora candidato inválido
        }
      } else {
        const queue = pendingCandidates.current.get(from) || [];
        queue.push(candidate);
        pendingCandidates.current.set(from, queue);
      }
    }

    function handleToggleAudio({ id, micOn }) {
      updateParticipant(id, { micOn });
    }

    function handleToggleVideo({ id, camOn }) {
      updateParticipant(id, { camOn });
    }

    function handleScreenShareStarted({ id }) {
      updateParticipant(id, { isSharingScreen: true });
    }

    function handleScreenShareStopped({ id }) {
      updateParticipant(id, { isSharingScreen: false });
    }

    function handleSpeaking({ id, isSpeaking }) {
      updateParticipant(id, { speaking: isSpeaking });
    }

    function handleChatMessage(message) {
      setMessages((prev) => [...prev, message]);
    }

    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("toggle-audio", handleToggleAudio);
    socket.on("toggle-video", handleToggleVideo);
    socket.on("screen-share-started", handleScreenShareStarted);
    socket.on("screen-share-stopped", handleScreenShareStopped);
    socket.on("speaking", handleSpeaking);
    socket.on("chat-message", handleChatMessage);

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("toggle-audio", handleToggleAudio);
      socket.off("toggle-video", handleToggleVideo);
      socket.off("screen-share-started", handleScreenShareStarted);
      socket.off("screen-share-stopped", handleScreenShareStopped);
      socket.off("speaking", handleSpeaking);
      socket.off("chat-message", handleChatMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, attachLocalTracks, closePeerConnection, flushPendingCandidates, getOrCreatePeerConnection, removeParticipant, updateParticipant]);

  // --- Encerra todas as conexões ao desmontar ---
  useEffect(() => {
    return () => {
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingCandidates.current.clear();
    };
  }, []);

  const sendChatMessage = useCallback(
    (text) => {
      if (!text?.trim()) return;
      socket.emit("chat-message", { text: text.trim() });
    },
    [socket]
  );

  const broadcastMicState = useCallback(
    (micOn) => socket.emit("toggle-audio", { micOn }),
    [socket]
  );

  const broadcastCamState = useCallback(
    (camOn) => socket.emit("toggle-video", { camOn }),
    [socket]
  );

  const broadcastScreenShareStart = useCallback(() => socket.emit("screen-share-started"), [socket]);
  const broadcastScreenShareStop = useCallback(() => socket.emit("screen-share-stopped"), [socket]);

  const broadcastSpeaking = useCallback(
    (isSpeaking) => socket.emit("speaking", { isSpeaking }),
    [socket]
  );

  /** Troca a track (câmera <-> compartilhamento de tela, ou troca de dispositivo) em todas as conexões ativas */
  const replaceOutgoingTrack = useCallback((kind, newTrack) => {
    peerConnections.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === kind);
      if (sender) {
        sender.replaceTrack(newTrack).catch(() => {});
      }
    });
  }, []);

  return {
    joined,
    joinError,
    selfId,
    participants,
    messages,
    sendChatMessage,
    broadcastMicState,
    broadcastCamState,
    broadcastScreenShareStart,
    broadcastScreenShareStop,
    broadcastSpeaking,
    replaceOutgoingTrack,
    setActiveVideoTrack,
  };
}
