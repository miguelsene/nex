import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Controla o acesso a câmera/microfone do usuário local, os toggles de
 * mic/câmera, a troca de dispositivos e o compartilhamento de tela.
 */
export function useMediaDevices() {
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [status, setStatus] = useState("requesting"); // requesting | ready | error
  const [errorMessage, setErrorMessage] = useState(null);

  const cameraStreamRef = useRef(null); // guarda a track de câmera original enquanto compartilha tela
  const screenStreamRef = useRef(null);
  const savedCameraTrackRef = useRef(null); // track de câmera salva antes do screen share

  const refreshDeviceList = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        cameras: list.filter((d) => d.kind === "videoinput"),
        microphones: list.filter((d) => d.kind === "audioinput"),
        speakers: list.filter((d) => d.kind === "audiooutput"),
      });
    } catch {
      // Silenciosamente ignora — a lista de dispositivos é um extra, não crítico
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream;

    async function init() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador não suporta acesso a câmera/microfone.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          // Uma configuração inicial mais leve abre a câmera mais depressa,
          // especialmente em celulares e notebooks mais modestos.
          video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        setLocalStream(stream);
        setStatus("ready");
        await refreshDeviceList();
      } catch (err) {
        if (cancelled) return;
        // Tenta apenas áudio caso a câmera não esteja disponível
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (cancelled) {
            audioOnly.getTracks().forEach((t) => t.stop());
            return;
          }
          cameraStreamRef.current = audioOnly;
          setLocalStream(audioOnly);
          setCamOn(false);
          setStatus("ready");
          setErrorMessage("Não foi possível acessar a câmera. Você entrou apenas com áudio.");
          await refreshDeviceList();
        } catch (audioErr) {
          setStatus("error");
          setErrorMessage(
            "Não foi possível acessar câmera/microfone. Verifique as permissões do navegador."
          );
        }
      }
    }

    init();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDeviceList);

    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDeviceList);
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [refreshDeviceList]);

  const toggleMic = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setCamOn(videoTrack.enabled);
  }, []);

  const switchCamera = useCallback(async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      const oldTrack = cameraStreamRef.current?.getVideoTracks()[0];
      if (oldTrack) {
        cameraStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      cameraStreamRef.current.addTrack(newTrack);
      newTrack.enabled = camOn;
      setLocalStream(new MediaStream(cameraStreamRef.current.getTracks()));
      return newTrack;
    } catch {
      setErrorMessage("Não foi possível trocar de câmera.");
      return null;
    }
  }, [camOn]);

  const switchMicrophone = useCallback(async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { deviceId: { exact: deviceId } },
      });
      const newTrack = newStream.getAudioTracks()[0];
      const oldTrack = cameraStreamRef.current?.getAudioTracks()[0];
      if (oldTrack) {
        cameraStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      cameraStreamRef.current.addTrack(newTrack);
      newTrack.enabled = micOn;
      setLocalStream(new MediaStream(cameraStreamRef.current.getTracks()));
      return newTrack;
    } catch {
      setErrorMessage("Não foi possível trocar de microfone.");
      return null;
    }
  }, [micOn]);

  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setErrorMessage("Compartilhamento de tela não é suportado neste navegador.");
        return null;
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      screenStreamRef.current = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];

      // Substitui a track de vídeo no stream local para o preview local também mostrar a tela
      const oldVideoTrack = cameraStreamRef.current?.getVideoTracks()[0];
      if (oldVideoTrack) {
        savedCameraTrackRef.current = oldVideoTrack; // salva para restaurar depois
        cameraStreamRef.current.removeTrack(oldVideoTrack);
      }
      cameraStreamRef.current.addTrack(screenTrack);
      setLocalStream(new MediaStream(cameraStreamRef.current.getTracks()));
      setIsSharingScreen(true);

      // Se o usuário parar pelo painel do navegador
      screenTrack.addEventListener("ended", () => {
        stopScreenShare();
      });

      return screenTrack;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    // Remove a track de tela do stream local
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getVideoTracks().forEach((t) => cameraStreamRef.current.removeTrack(t));
      // Restaura a track de câmera original
      if (savedCameraTrackRef.current) {
        cameraStreamRef.current.addTrack(savedCameraTrackRef.current);
        savedCameraTrackRef.current = null;
      }
    }

    screenStreamRef.current = null;
    setIsSharingScreen(false);

    const originalCameraTrack = cameraStreamRef.current?.getVideoTracks()[0] || null;
    setLocalStream(new MediaStream(cameraStreamRef.current?.getTracks() || []));
    return originalCameraTrack;
  }, []);

  return {
    localStream,
    micOn,
    camOn,
    isSharingScreen,
    devices,
    status,
    errorMessage,
    toggleMic,
    toggleCam,
    switchCamera,
    switchMicrophone,
    startScreenShare,
    stopScreenShare,
  };
}
