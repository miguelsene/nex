import { useCallback, useEffect, useRef, useState } from "react";
import { createPeerConnection, optimizeAudioSdp } from "../services/webrtc.js";

export function useWebRTC({ socket, roomId, name, avatar, userId, localStream, iceServers, onEvent }) {
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [participants, setParticipants] = useState(new Map());
  const [messages, setMessages] = useState([]);

  const pcs = useRef(new Map());               // peerId -> RTCPeerConnection
  const pending = useRef(new Map());           // peerId -> ICECandidate[]
  const localStreamRef = useRef(localStream);
  const iceServersRef = useRef(iceServers);
  const participantsRef = useRef(participants);
  const joinedRef = useRef(false);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { iceServersRef.current = iceServers; }, [iceServers]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  const updateParticipant = useCallback((id, patch) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) || { id, name: "Convidado", avatar: null, userId: null, micOn: true, camOn: true, isSharingScreen: false, stream: null, speaking: false };
      next.set(id, { ...cur, ...patch });
      return next;
    });
  }, []);

  const removeParticipant = useCallback((id) => {
    setParticipants((prev) => { const next = new Map(prev); next.delete(id); return next; });
  }, []);

  // Adiciona todas as tracks locais na PC (áudio + vídeo)
  const attachTracks = useCallback((pc) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const existingKinds = new Set(pc.getSenders().map((s) => s.track?.kind).filter(Boolean));
    for (const track of stream.getTracks()) {
      if (!existingKinds.has(track.kind)) {
        pc.addTrack(track, stream);
      }
    }
  }, []);

  const flushPending = useCallback(async (peerId, pc) => {
    const queue = pending.current.get(peerId) || [];
    for (const c of queue) {
      try { await pc.addIceCandidate(c); } catch { /* ignora */ }
    }
    pending.current.delete(peerId);
  }, []);

  const createPC = useCallback((peerId, meta) => {
    const existing = pcs.current.get(peerId);
    if (existing) return existing;

    const pc = createPeerConnection(iceServersRef.current, {
      onIceCandidate: (candidate) => {
        socket.emit("ice-candidate", { to: peerId, candidate });
      },
      onTrack: (event) => {
        // Garante que sempre temos um stream válido com a track
        let stream = event.streams[0];
        if (!stream) {
          stream = new MediaStream();
          stream.addTrack(event.track);
        }
        updateParticipant(peerId, { stream });
      },
      onConnectionStateChange: (state) => {
        if (state === "failed") updateParticipant(peerId, { connectionLost: true });
      },
    });

    pcs.current.set(peerId, pc);
    updateParticipant(peerId, {
      id: peerId,
      name: meta?.name || "Convidado",
      avatar: meta?.avatar || null,
      userId: meta?.userId || null,
      micOn: meta?.micOn ?? true,
      camOn: meta?.camOn ?? true,
      isSharingScreen: meta?.isSharingScreen ?? false,
    });
    return pc;
  }, [socket, updateParticipant]);

  const closePC = useCallback((peerId) => {
    pcs.current.get(peerId)?.close();
    pcs.current.delete(peerId);
    pending.current.delete(peerId);
  }, []);

  const sendOffer = useCallback(async (peerId, meta) => {
    const pc = createPC(peerId, meta);
    attachTracks(pc);
    try {
      const offer = await pc.createOffer();
      offer.sdp = optimizeAudioSdp(offer.sdp);
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: peerId, offer: pc.localDescription });
    } catch { /* ignora */ }
  }, [attachTracks, createPC, socket]);

  // Join — dispara assim que socket, stream e iceServers estiverem prontos
  useEffect(() => {
    // iceServers pode ser null (falha no fetch) — usa STUN padrão nesse caso, não bloqueia
    if (!socket || !roomId || !name || !localStream) return;
    if (joinedRef.current) return;

    function doJoin() {
      if (joinedRef.current) return;
      if (!localStreamRef.current) return;
      joinedRef.current = true;

      socket.emit("join-room", { roomId, name, avatar, userId }, async (res) => {
        if (!res?.ok) {
          setJoinError(res?.error || "Não foi possível entrar na sala.");
          joinedRef.current = false;
          return;
        }
        setSelfId(res.self.id);
        setJoined(true);
        for (const p of res.participants) {
          await sendOffer(p.id, p);
        }
      });
    }

    if (socket.connected) doJoin();
    else {
      socket.once("connect", doJoin);
      return () => socket.off("connect", doJoin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId, name, localStream, userId, avatar]);

  // Listeners de sinalização
  useEffect(() => {
    if (!socket) return;

    function onUserJoined({ participant }) {
      updateParticipant(participant.id, participant);
      onEvent?.({ type: "joined", name: participant.name });
    }

    function onUserLeft({ id }) {
      const leaving = participantsRef.current.get(id);
      closePC(id);
      removeParticipant(id);
      if (leaving) onEvent?.({ type: "left", name: leaving.name });
    }

    async function onOffer({ from, offer, meta }) {
      const pc = createPC(from, meta);
      attachTracks(pc);
      try {
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-remote-offer") {
          await pc.setLocalDescription({ type: "rollback" }).catch(() => {});
        }
        await pc.setRemoteDescription(offer);
        await flushPending(from, pc);
        const answer = await pc.createAnswer();
        answer.sdp = optimizeAudioSdp(answer.sdp);
        await pc.setLocalDescription(answer);
        socket.emit("answer", { to: from, answer: pc.localDescription });
      } catch { /* ignora */ }
    }

    async function onAnswer({ from, answer, meta }) {
      const pc = pcs.current.get(from);
      if (!pc) return;
      if (meta) updateParticipant(from, { name: meta.name, avatar: meta.avatar || null, userId: meta.userId || null });
      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(answer);
          await flushPending(from, pc);
        }
      } catch { /* ignora */ }
    }

    async function onIceCandidate({ from, candidate }) {
      const pc = pcs.current.get(from);
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(candidate); } catch { /* ignora */ }
      } else {
        const q = pending.current.get(from) || [];
        q.push(candidate);
        pending.current.set(from, q);
      }
    }

    socket.on("user-joined", onUserJoined);
    socket.on("user-left", onUserLeft);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("toggle-audio", ({ id, micOn }) => updateParticipant(id, { micOn }));
    socket.on("toggle-video", ({ id, camOn }) => updateParticipant(id, { camOn }));
    socket.on("screen-share-started", ({ id }) => updateParticipant(id, { isSharingScreen: true }));
    socket.on("screen-share-stopped", ({ id }) => updateParticipant(id, { isSharingScreen: false }));
    socket.on("speaking", ({ id, isSpeaking }) => updateParticipant(id, { speaking: isSpeaking }));
    socket.on("chat-message", (msg) => setMessages((prev) => [...prev, msg]));

    return () => {
      socket.off("user-joined", onUserJoined);
      socket.off("user-left", onUserLeft);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("toggle-audio");
      socket.off("toggle-video");
      socket.off("screen-share-started");
      socket.off("screen-share-stopped");
      socket.off("speaking");
      socket.off("chat-message");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, attachTracks, closePC, createPC, flushPending, removeParticipant, updateParticipant]);

  useEffect(() => {
    return () => {
      joinedRef.current = false;
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      pending.current.clear();
    };
  }, []);

  // Substitui uma track em todas as PCs ativas (ex: câmera -> tela ou vice-versa)
  const replaceOutgoingTrack = useCallback((kind, newTrack) => {
    pcs.current.forEach(async (pc, peerId) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      if (sender) {
        await sender.replaceTrack(newTrack).catch(() => {});
      } else if (newTrack) {
        const stream = localStreamRef.current || new MediaStream([newTrack]);
        try { pc.addTrack(newTrack, stream); } catch { return; }
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { to: peerId, offer: pc.localDescription });
        } catch { /* ignora */ }
      }
    });
  }, [socket]);

  return {
    joined,
    joinError,
    selfId,
    participants,
    messages,
    sendChatMessage: useCallback((text) => { if (text?.trim()) socket.emit("chat-message", { text: text.trim() }); }, [socket]),
    broadcastMicState: useCallback((micOn) => socket.emit("toggle-audio", { micOn }), [socket]),
    broadcastCamState: useCallback((camOn) => socket.emit("toggle-video", { camOn }), [socket]),
    broadcastScreenShareStart: useCallback(() => socket.emit("screen-share-started"), [socket]),
    broadcastScreenShareStop: useCallback(() => socket.emit("screen-share-stopped"), [socket]),
    broadcastSpeaking: useCallback((isSpeaking) => socket.emit("speaking", { isSpeaking }), [socket]),
    replaceOutgoingTrack,
    setActiveVideoTrack: useCallback(() => {}, []), // mantido por compatibilidade
  };
}
