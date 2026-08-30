import { useEffect, useRef, useState } from "react";

export default function SettingsModal({
  devices = { cameras: [], microphones: [], speakers: [] },
  localStream,
  settings = {
    quality: "media",
    micVolume: 70,
    layout: "grid",
    themeMode: "dark",
    performanceMode: false,
  },
  onSettingChange,
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
          <label htmlFor="quality-select">Qualidade da câmera</label>
          <select id="quality-select" value={settings.quality} onChange={(e) => onSettingChange("quality", e.target.value)}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>

        <div className="settings-section">
          <label htmlFor="volume-range">Volume do microfone</label>
          <input id="volume-range" type="range" min="0" max="100" value={settings.micVolume} onChange={(e) => onSettingChange("micVolume", Number(e.target.value))} />
          <small>{settings.micVolume}%</small>
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

        <div className="settings-section">
          <label htmlFor="layout-select">Layout da chamada</label>
          <select id="layout-select" value={settings.layout} onChange={(e) => onSettingChange("layout", e.target.value)}>
            <option value="grid">Grade</option>
            <option value="single">1x1</option>
            <option value="focus">Foco principal</option>
          </select>
        </div>

        <div className="settings-section">
          <label htmlFor="theme-select">Tema</label>
          <select id="theme-select" value={settings.themeMode} onChange={(e) => onSettingChange("themeMode", e.target.value)}>
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
          </select>
        </div>

        <div className="settings-section">
          <label htmlFor="performance-select">Modo de performance</label>
          <select id="performance-select" value={settings.performanceMode ? "economia" : "padrao"} onChange={(e) => onSettingChange("performanceMode", e.target.value === "economia")}>
            <option value="padrao">Padrão</option>
            <option value="economia">Economia de energia</option>
          </select>
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
