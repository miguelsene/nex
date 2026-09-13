import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_REQ = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO_REQ = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } };

// Núcleo de mídia local. Regras:
// 1. start() pede mic+cam UMA vez e aplica prefs antes de expor o stream.
// 2. ready só vira true depois disso — join acontece depois do ready.
// 3. Mic/cam NUNCA param a track, só track.enabled (parar = renegociar = tela preta).
export function useCallMedia() {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState({ cameras: [], mics: [], speakers: [] });
  const ref = useRef(null);
  const screenRef = useRef(null);
  const started = useRef(false);

  const start = useCallback(async (prefs = {}) => {
    if (started.current && ref.current) return ref.current;
    started.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Sem suporte.");
      let audio = null;
      let video = null;
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_REQ, video: false });
        audio = s.getAudioTracks()[0] || null;
      } catch { audio = null; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: VIDEO_REQ, audio: false });
        video = s.getVideoTracks()[0] || null;
      } catch { video = null; }
      if (!audio && !video) throw new Error("Sem mic/câmera.");
      if (audio) audio.enabled = prefs.withMic ?? false;
      if (video) video.enabled = prefs.withCam ?? false;
      const stream = new MediaStream([audio, video].filter(Boolean));
      ref.current = stream;
      setLocalStream(stream);
      setMicOn(Boolean(audio && audio.enabled));
      setCamOn(Boolean(video && video.enabled));
      setReady(true);
      refreshDevices();
      return stream;
    } catch (e) {
      started.current = false;
      setError(e?.message || "Falha de mídia.");
      return null;
    }
  }, [refreshDevices]);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        cameras: list.filter((d) => d.kind === "videoinput"),
        mics: list.filter((d) => d.kind === "audioinput"),
        speakers: list.filter((d) => d.kind === "audiooutput"),
      });
    } catch { /* labels opcionais */ }
  }, []);

  useEffect(() => () => {
    ref.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const setMic = useCallback((on) => {
    const t = ref.current?.getAudioTracks()[0];
    if (t && t.readyState === "live") { t.enabled = on; setMicOn(on); return t; }
    return null;
  }, []);

  const setCam = useCallback((on) => {
    const t = ref.current?.getVideoTracks()[0];
    if (t && t.readyState === "live") { t.enabled = on; setCamOn(on); return t; }
    return null;
  }, []);

  const startShare = useCallback(async () => {
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).catch(() => null);
    if (!s) return null;
    screenRef.current = s;
    setScreenStream(s);
    setSharing(true);
    return s;
  }, []);

  const stopShare = useCallback(() => {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setScreenStream(null);
    setSharing(false);
  }, []);

  return {
    localStream, screenStream, micOn, camOn, sharing,
    ready, error, devices, start, setMic, setCam,
    startShare, stopShare, refreshDevices,
  };
}
