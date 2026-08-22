import { useEffect, useRef } from "react";

const SPEAKING_THRESHOLD = 14; // 0-255, sensibilidade do detector
const CHECK_INTERVAL_MS = 200;

/**
 * Analisa o volume do stream de áudio local e chama onChange(isSpeaking)
 * sempre que o estado de "está falando" mudar.
 */
export function useSpeakingDetector(stream, enabled, onChange) {
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const lastStateRef = useRef(false);

  useEffect(() => {
    if (!stream || !enabled) return undefined;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return undefined;

    let intervalId;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      intervalId = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        const isSpeaking = avg > SPEAKING_THRESHOLD;
        if (isSpeaking !== lastStateRef.current) {
          lastStateRef.current = isSpeaking;
          onChange?.(isSpeaking);
        }
      }, CHECK_INTERVAL_MS);
    } catch {
      // Web Audio indisponível — indicador de fala simplesmente não aparece
    }

    return () => {
      clearInterval(intervalId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      lastStateRef.current = false;
    };
  }, [stream, enabled, onChange]);
}
