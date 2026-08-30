import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const VIDEO_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 360 },
  frameRate: { ideal: 24 },
};

export function useMediaDevices() {
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [status, setStatus] = useState("requesting");
  const [errorMessage, setErrorMessage] = useState(null);

  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const savedCameraTrackRef = useRef(null);

  const refreshDeviceList = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        cameras: list.filter((d) => d.kind === "videoinput"),
        microphones: list.filter((d) => d.kind === "audioinput"),
        speakers: list.filter((d) => d.kind === "audiooutput"),
      });
    } catch {
      // Device labels are optional; the call can continue without them.
    }
  }, []);

  const setCurrentStream = useCallback((stream) => {
    cameraStreamRef.current = stream;
    setLocalStream(new MediaStream(stream.getTracks()));
    setMicOn(Boolean(stream.getAudioTracks().find((track) => track.readyState === "live" && track.enabled)));
    setCamOn(Boolean(stream.getVideoTracks().find((track) => track.readyState === "live" && track.enabled)));
  }, []);

  const acquireAudioTrack = useCallback(async () => {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: AUDIO_CONSTRAINTS,
      video: false,
    });
    const track = audioStream.getAudioTracks()[0];
    if (!track) throw new Error("Nenhum microfone foi encontrado.");
    return track;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador nao suporta acesso a camera/microfone.");
        }

        let audioTrack;
        let videoTrack = null;

        try {
          audioTrack = await acquireAudioTrack();
        } catch {
          const combined = await navigator.mediaDevices.getUserMedia({
            video: VIDEO_CONSTRAINTS,
            audio: AUDIO_CONSTRAINTS,
          });
          audioTrack = combined.getAudioTracks()[0];
          videoTrack = combined.getVideoTracks()[0] || null;
        }

        if (!audioTrack) throw new Error("Nenhum microfone foi encontrado.");

        if (!videoTrack) {
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({
              video: VIDEO_CONSTRAINTS,
              audio: false,
            });
            videoTrack = videoStream.getVideoTracks()[0] || null;
          } catch {
            setCamOn(false);
            setErrorMessage("Nao foi possivel acessar a camera. Voce entrou apenas com audio.");
          }
        }

        const stream = new MediaStream([audioTrack, ...(videoTrack ? [videoTrack] : [])]);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setCurrentStream(stream);
        setStatus("ready");
        await refreshDeviceList();
      } catch {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage("Nao foi possivel acessar camera/microfone. Verifique as permissoes do navegador.");
      }
    }

    init();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDeviceList);

    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDeviceList);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [acquireAudioTrack, refreshDeviceList, setCurrentStream]);

  const toggleMic = useCallback(async () => {
    const stream = cameraStreamRef.current;
    if (!stream) return null;

    let audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState === "ended") {
      try {
        audioTrack = await acquireAudioTrack();
        stream.addTrack(audioTrack);
        setCurrentStream(stream);
        setMicOn(true);
        return audioTrack;
      } catch {
        setErrorMessage("Nao foi possivel ativar o microfone. Confira a permissao do navegador.");
        setMicOn(false);
        return null;
      }
    }

    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
    return audioTrack;
  }, [acquireAudioTrack, setCurrentStream]);

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
      setErrorMessage("Nao foi possivel trocar de camera.");
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
      setErrorMessage("Nao foi possivel trocar de microfone.");
      return null;
    }
  }, [micOn]);

  const setVideoQuality = useCallback(async (quality) => {
    const currentVideoTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (!currentVideoTrack || !navigator.mediaDevices?.getUserMedia) return null;

    try {
      const presets = {
        baixa: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20 } },
        media: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 } },
        alta: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      };

      const constraints = {
        video: {
          ...(presets[quality] || presets.media),
          deviceId: currentVideoTrack.getSettings?.().deviceId ? { exact: currentVideoTrack.getSettings().deviceId } : undefined,
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return null;

      if (cameraStreamRef.current) {
        const oldTrack = cameraStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          cameraStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        cameraStreamRef.current.addTrack(newTrack);
      }

      newTrack.enabled = camOn;
      setLocalStream(new MediaStream(cameraStreamRef.current?.getTracks() || []));
      return newTrack;
    } catch {
      setErrorMessage("Nao foi possivel ajustar a qualidade da camera.");
      return null;
    }
  }, [camOn]);

  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setErrorMessage("Compartilhamento de tela nao e suportado neste navegador.");
        return null;
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      screenStreamRef.current = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];
      const oldVideoTrack = cameraStreamRef.current?.getVideoTracks()[0];
      if (oldVideoTrack) {
        savedCameraTrackRef.current = oldVideoTrack;
        cameraStreamRef.current.removeTrack(oldVideoTrack);
      }
      cameraStreamRef.current.addTrack(screenTrack);
      setLocalStream(new MediaStream(cameraStreamRef.current.getTracks()));
      setIsSharingScreen(true);

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
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getVideoTracks().forEach((track) => cameraStreamRef.current.removeTrack(track));
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
    setVideoQuality,
    startScreenShare,
    stopScreenShare,
  };
}
