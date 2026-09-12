import { useCallback, useEffect, useRef, useState } from "react";
import { createPeerConnection, optimizeAudioSdp } from "../services/webrtc.js";

export function useWebRTC({ socket, roomId, name, avatar, userId, localStream, iceServers, onEvent }) {
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [participants, setParticipants] = useState(new Map());
  const [messages, setMessages] = useState([]);

  const pcs = useRef(new Map());          // peerId -> RTCPeerConnection
  const streams = useRef(new Map());      // peerId -> MediaStream (acumula tracks)
  const pending = useRef(new Map());      // peerId -> ICECandidate[]
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

  const getOrCreateStream = useCallback((peerId) => {
    if (!streams.current.has(peerId)) {
      streams.current.set(peerId, new MediaStream());
    }
    return streams.current.get(peerId);
  }, []);

  const createPC = useCallback((peerId, meta) => {
    if (pcs.current.has(peerId)) return pcs.current.get(peerId);

    const pc = createPeerConnection(iceServersRef.current, {
      onIceCandidate: (candidate) => {
        socket.emit("ice-candidate", { to: peerId, candidate });
      },
      onTrack: (event) => {
        // Acumula todas as tracks no mesmo MediaStream persistente do peer
        const remoteStream = getOrCreateStream(peerId);
        const track = event.track;

        // Remove track antiga do mesmo kind se existir
        remoteStream.getTracks()
          .filter((t) => t.kind === track.kind)
          .forEach((t) => remoteStream.removeTrack(t));

        remoteStream.addTrack(track);

        // Quando a track terminar, remove do stream
        track.addEventListener("ended", () => {
          remoteStream.removeTrack(track);
        });

        updateParticipant(peerId, { stream: remoteStream });
      },
      onConnectionStateChange: (state) => {
        if (state === "failed") updateParticipant(peerId, { connectionLost: true });
        if (state === "closed") removeParticipant(peerId);
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
  }, [socket, updateParticipant, removeParticipant, getOrCreateStream]);

  const closePC = useCallback((peerId) => {
    pcs.current.get(peerId)?.close();
    pcs.current.delete(peerId);
    streams.current.delete(peerId);
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

  // Join
  useEffect(() => {
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

    function onToggleAudio({ id, micOn }) { updateParticipant(id, { micOn }); }
    function onToggleVideo({ id, camOn }) { updateParticipant(id, { camOn }); }
    function onScreenShareStarted({ id }) { updateParticipant(id, { isSharingScreen: true }); }
    function onScreenShareStopped({ id }) { updateParticipant(id, { isSharingScreen: false }); }
    function onSpeaking({ id, isSpeaking }) { updateParticipant(id, { speaking: isSpeaking }); }
    function onChatMessage(msg) { setMessages((prev) => [...prev, msg]); }

    socket.on("user-joined", onUserJoined);
    socket.on("user-left", onUserLeft);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("toggle-audio", onToggleAudio);
    socket.on("toggle-video", onToggleVideo);
    socket.on("screen-share-started", onScreenShareStarted);
    socket.on("screen-share-stopped", onScreenShareStopped);
    socket.on("speaking", onSpeaking);
    socket.on("chat-message", onChatMessage);

    return () => {
      socket.off("user-joined", onUserJoined);
      socket.off("user-left", onUserLeft);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("toggle-audio", onToggleAudio);
      socket.off("toggle-video", onToggleVideo);
      socket.off("screen-share-started", onScreenShareStarted);
      socket.off("screen-share-stopped", onScreenShareStopped);
      socket.off("speaking", onSpeaking);
      socket.off("chat-message", onChatMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, attachTracks, closePC, createPC, flushPending, removeParticipant, updateParticipant]);

  useEffect(() => {
    return () => {
      joinedRef.current = false;
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      streams.current.clear();
      pending.current.clear();
    };
  }, []);

  const replaceOutgoingTrack = useCallback(async (kind, newTrack) => {
    for (const [peerId, pc] of pcs.current) {
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      if (sender) {
        await sender.replaceTrack(newTrack).catch(() => {});
      } else if (newTrack) {
        const stream = localStreamRef.current || new MediaStream([newTrack]);
        try {
          pc.addTrack(newTrack, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { to: peerId, offer: pc.localDescription });
        } catch { /* ignora */ }
      }
    }
  }, [socket]);

  const broadcastMicState = useCallback((micOn) => socket.emit("toggle-audio", { micOn }), [socket]);
  const broadcastCamState = useCallback((camOn) => socket.emit("toggle-video", { camOn }), [socket]);
  const broadcastScreenShareStart = useCallback(() => socket.emit("screen-share-started"), [socket]);
  const broadcastScreenShareStop = useCallback(() => socket.emit("screen-share-stopped"), [socket]);
  const broadcastSpeaking = useCallback((isSpeaking) => socket.emit("speaking", { isSpeaking }), [socket]);
  const sendChatMessage = useCallback((text) => { if (text?.trim()) socket.emit("chat-message", { text: text.trim() }); }, [socket]);

  return {
    joined, joinError, selfId, participants, messages,
    sendChatMessage, broadcastMicState, broadcastCamState,
    broadcastScreenShareStart, broadcastScreenShareStop,
    broadcastSpeaking, replaceOutgoingTrack,
  };
}
