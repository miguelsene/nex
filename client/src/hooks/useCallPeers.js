import { useCallback, useEffect, useRef, useState } from "react";
import { createPeerConnection, optimizeAudioSdp } from "../services/webrtc.js";

const blank = (id) => ({
  id, name: "Convidado", avatar: null, userId: null,
  micOn: true, camOn: true, sharing: false,
  stream: null, speaking: false, lost: false,
});

// Núcleo WebRTC refeito. Regras:
// 1. join() SÓ roda com stream pronto + ICE pronto (sem isso = track morta).
// 2. Quem ENTROU (lista do join-room) cria offers; quem RECEBE responde.
//    Sem double-offer = sem rollback wars.
// 3. Tracks trocam via replaceTrack (sem renegociar). Renegocia só se não há sender.
// 4. ICE tardio vai pra fila e é drenado após remoteDescription.
export function useCallPeers({ socket, roomId, name, avatar, userId, localStream, iceServers, onEvent }) {
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [peers, setPeers] = useState(new Map());
  const [messages, setMessages] = useState([]);

  const pcs = useRef(new Map());
  const streams = useRef(new Map());
  const queue = useRef(new Map());
  const joinedOnce = useRef(false);
  const streamRef = useRef(localStream);
  const iceRef = useRef(iceServers);
  const peersRef = useRef(peers);
  useEffect(() => { streamRef.current = localStream; }, [localStream]);
  useEffect(() => { iceRef.current = iceServers; }, [iceServers]);
  useEffect(() => { peersRef.current = peers; }, [peers]);

  const patch = useCallback((id, p) => {
    setPeers((prev) => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) || blank(id)), ...p });
      return next;
    });
  }, []);

  const drop = useCallback((id) => {
    setPeers((prev) => { const n = new Map(prev); n.delete(id); return n; });
  }, []);

  const streamOf = useCallback((id) => {
    if (!streams.current.has(id)) streams.current.set(id, new MediaStream());
    return streams.current.get(id);
  }, []);

  const close = useCallback((id) => {
    try { pcs.current.get(id)?.close(); } catch { /* noop */ }
    pcs.current.delete(id);
    streams.current.delete(id);
    queue.current.delete(id);
  }, []);

  const attach = useCallback((pc) => {
    const s = streamRef.current;
    if (!s) return;
    const kinds = new Set(pc.getSenders().map((x) => x.track?.kind).filter(Boolean));
    for (const t of s.getTracks()) {
      if (t.readyState === "live" && !kinds.has(t.kind)) {
        try { pc.addTrack(t, s); } catch { /* noop */ }
      }
    }
  }, []);

  const drain = useCallback(async (id, pc) => {
    const q = queue.current.get(id) || [];
    queue.current.delete(id);
    for (const c of q) {
      try { await pc.addIceCandidate(c); } catch { /* noop */ }
    }
  }, []);

  const makePC = useCallback((id, meta) => {
    if (pcs.current.has(id)) return pcs.current.get(id);
    const pc = createPeerConnection(iceRef.current, {
      onIceCandidate: (c) => socket.emit("ice-candidate", { to: id, candidate: c }),
      onTrack: (ev) => {
        const rs = streamOf(id);
        const t = ev.track;
        rs.getTracks().filter((x) => x.kind === t.kind).forEach((x) => { try { rs.removeTrack(x); } catch { /* noop */ } });
        try { rs.addTrack(t); } catch { /* noop */ }
        t.onended = () => { try { rs.removeTrack(t); } catch { /* noop */ } };
        patch(id, { stream: rs });
      },
      onConnectionStateChange: (st) => {
        if (st === "failed") patch(id, { lost: true });
        else if (st === "connected") patch(id, { lost: false });
        else if (st === "closed") drop(id);
      },
    });
    pcs.current.set(id, pc);
    patch(id, {
      id, name: meta?.name || "Convidado", avatar: meta?.avatar || null,
      userId: meta?.userId || null, micOn: meta?.micOn ?? true,
      camOn: meta?.camOn ?? true, sharing: meta?.isSharingScreen ?? false,
    });
    return pc;
  }, [socket, streamOf, patch, drop]);

  const offerTo = useCallback(async (id, meta) => {
    const pc = makePC(id, meta);
    attach(pc);
    try {
      const offer = await pc.createOffer();
      offer.sdp = optimizeAudioSdp(offer.sdp);
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: id, offer: pc.localDescription });
    } catch { /* noop */ }
  }, [makePC, attach, socket]);

  const join = useCallback(() => {
    if (joinedOnce.current) return;
    if (!socket || !roomId || !name) return;
    if (!streamRef.current) return;           // sem mídia = sem join
    if (!iceRef.current) return;              // sem ICE = sem join
    joinedOnce.current = true;
    const run = () => {
      socket.emit("join-room",
        { roomId, name, avatar, userId },
        async (res) => {
          if (!res?.ok) {
            setJoinError(res?.error || "Não foi possível entrar.");
            joinedOnce.current = false;
            return;
          }
          setSelfId(res.self.id);
          setJoined(true);
          for (const p of res.participants || []) {
            await offerTo(p.id, p);           // quem entra oferece
          }
        });
    };
    if (socket.connected) run();
    else socket.once("connect", run);
  }, [socket, roomId, name, avatar, userId, offerTo]);

  useEffect(() => {
    if (!socket) return;
    const onJoined = ({ participant }) => {
      patch(participant.id, participant);
      onEvent?.({ type: "joined", name: participant.name });
    };
    const onLeft = ({ id }) => {
      const who = peersRef.current.get(id);
      close(id); drop(id);
      if (who) onEvent?.({ type: "left", name: who.name });
    };
    const onOffer = async ({ from, offer, meta }) => {
      const pc = makePC(from, meta);
      attach(pc);
      try {
        // Resolvedor de glare: quem tem ID menor vence, outro faz rollback
        if (pc.signalingState !== "stable") {
          const polite = String(socket.id) > String(from);
          if (!polite) return; // impolite ignora offer concorrente
          try { await pc.setLocalDescription({ type: "rollback" }); } catch { /* noop */ }
        }
        await pc.setRemoteDescription(offer);
        await drain(from, pc);
        const ans = await pc.createAnswer();
        ans.sdp = optimizeAudioSdp(ans.sdp);
        await pc.setLocalDescription(ans);
        socket.emit("answer", { to: from, answer: pc.localDescription });
      } catch { /* noop */ }
    };
    const onAnswer = async ({ from, answer, meta }) => {
      const pc = pcs.current.get(from);
      if (!pc) return;
      if (meta) patch(from, { name: meta.name, avatar: meta.avatar || null });
      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(answer);
          await drain(from, pc);
        }
      } catch { /* noop */ }
    };
    const onIce = async ({ from, candidate }) => {
      const pc = pcs.current.get(from);
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(candidate); } catch { /* noop */ }
      } else {
        const q = queue.current.get(from) || [];
        q.push(candidate);
        queue.current.set(from, q);
      }
    };
    socket.on("user-joined", onJoined);
    socket.on("user-left", onLeft);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("toggle-audio", ({ id, micOn }) => patch(id, { micOn }));
    socket.on("toggle-video", ({ id, camOn }) => patch(id, { camOn }));
    socket.on("screen-share-started", ({ id }) => patch(id, { sharing: true }));
    socket.on("screen-share-stopped", ({ id }) => patch(id, { sharing: false }));
    socket.on("speaking", ({ id, isSpeaking }) => patch(id, { speaking: isSpeaking }));
    socket.on("chat-message", (m) => setMessages((p) => [...p, m]));
    return () => {
      socket.off("user-joined", onJoined);
      socket.off("user-left", onLeft);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIce);
      socket.off("toggle-audio");
      socket.off("toggle-video");
      socket.off("screen-share-started");
      socket.off("screen-share-stopped");
      socket.off("speaking");
      socket.off("chat-message");
    };
  }, [socket, makePC, attach, drain, close, drop, patch, onEvent]);

  useEffect(() => () => {
    joinedOnce.current = false;
    pcs.current.forEach((pc) => { try { pc.close(); } catch { /* noop */ } });
    pcs.current.clear(); streams.current.clear(); queue.current.clear();
  }, []);

  const replaceTrack = useCallback(async (kind, track) => {
    for (const [id, pc] of pcs.current) {
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      if (sender) {
        try { await sender.replaceTrack(track); } catch { /* noop */ }
      } else if (track) {
        try {
          pc.addTrack(track, streamRef.current || new MediaStream([track]));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { to: id, offer: pc.localDescription });
        } catch { /* noop */ }
      }
    }
  }, [socket]);

  const hangup = useCallback(() => {
    pcs.current.forEach((pc) => { try { pc.close(); } catch { /* noop */ } });
    pcs.current.clear(); streams.current.clear(); queue.current.clear();
    joinedOnce.current = false;
    setJoined(false); setPeers(new Map()); setMessages([]);
  }, []);

  const emit = useCallback((ev, data) => socket.emit(ev, data), [socket]);
  const say = useCallback((text) => {
    if (text?.trim()) socket.emit("chat-message", { text: text.trim() });
  }, [socket]);

  return {
    joined, joinError, selfId, peers, messages,
    join, hangup, replaceTrack, emit, say,
  };
}

