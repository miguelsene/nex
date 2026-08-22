import { useEffect, useRef, useState } from "react";

export default function SettingsModal({
  devices,
  localStream,
  onSwitchCamera,
  onSwitchMicrophone,
  onSpeakerChange,
  onClose,
}) {
  const previewRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    if (previewRef.current && localStream) {
      previewRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Medidor simples de nível do microfone para o usuário testar o dispositivo
  useEffect(() => {
    if (!localStream) return undefined;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return undefined;

    let audioCtx;
    let intervalId;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      intervalId = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        setMicLevel(Math.min(100, Math.round((avg / 90) * 100)));
      }, 100);
    } catch {
      // sem suporte a Web Audio — apenas não mostra o medidor
    }

    return () => {
      clearInterval(intervalId);
      audioCtx?.close().catch(() => {});
    };
  }, [localStream]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configurações</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="settings-preview">
          <video ref={previewRef} autoPlay playsInline muted style={{ transform: "scaleX(-1)" }} />
        </div>

        <div className="settings-section">
          <label htmlFor="camera-select">Câmera</label>
          <select id="camera-select" onChange={(e) => onSwitchCamera(e.target.value)} defaultValue="">
            <option value="" disabled>
              Selecione uma câmera
            </option>
            {devices.cameras.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Câmera"}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-section">
          <label htmlFor="mic-select">Microfone</label>
          <select id="mic-select" onChange={(e) => onSwitchMicrophone(e.target.value)} defaultValue="">
            <option value="" disabled>
              Selecione um microfone
            </option>
            {devices.microphones.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Microfone"}
              </option>
            ))}
          </select>
          <div className="mic-meter">
            <div className="mic-meter-fill" style={{ width: `${micLevel}%` }} />
          </div>
        </div>

        {devices.speakers.length > 0 && (
          <div className="settings-section">
            <label htmlFor="speaker-select">Saída de áudio</label>
            <select id="speaker-select" onChange={(e) => onSpeakerChange(e.target.value)} defaultValue="">
              <option value="" disabled>
                Selecione a saída de áudio
              </option>
              {devices.speakers.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Alto-falante"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
