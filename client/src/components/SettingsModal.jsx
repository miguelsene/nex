import { useEffect, useRef, useState } from "react";

const TABS = [
  { id: "devices", label: "Dispositivos", icon: "bi-camera-video-fill" },
  { id: "call", label: "Chamada", icon: "bi-telephone-fill" },
  { id: "appearance", label: "Aparência", icon: "bi-palette-fill" },
];

export default function SettingsModal({
  devices = { cameras: [], microphones: [], speakers: [] },
  localStream,
  settings = { quality: "media", micVolume: 70, layout: "grid", themeMode: "dark", performanceMode: false },
  onSettingChange,
  onSwitchCamera,
  onSwitchMicrophone,
  onSpeakerChange,
  onClose,
}) {
  const previewRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);
  const [activeTab, setActiveTab] = useState("devices");
  const [camPreviewOn, setCamPreviewOn] = useState(false);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;
    if (camPreviewOn && localStream) {
      video.srcObject = localStream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [localStream, camPreviewOn]);

  useEffect(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    let audioCtx, intervalId;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      intervalId = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setMicLevel(Math.min(100, Math.round((avg / 90) * 100)));
      }, 100);
    } catch {}
    return () => { clearInterval(intervalId); audioCtx?.close().catch(() => {}); };
  }, [localStream]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            <i className="bi bi-gear-fill" />
            <h3>Configurações</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="settings-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`bi ${tab.icon}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-body">
          {activeTab === "devices" && (
            <>
              <div className="settings-preview-wrap">
                <video ref={previewRef} autoPlay playsInline muted style={{ transform: "scaleX(-1)" }} />
                {!camPreviewOn && (
                  <div className="settings-preview-off">
                    <i className="bi bi-camera-video-off-fill" />
                    <span>Prévia desativada</span>
                  </div>
                )}
                <button
                  type="button"
                  className={`settings-preview-toggle ${camPreviewOn ? "active" : ""}`}
                  onClick={() => setCamPreviewOn((v) => !v)}
                >
                  <i className={`bi ${camPreviewOn ? "bi-camera-video-fill" : "bi-camera-video-off-fill"}`} />
                  {camPreviewOn ? "Desativar prévia" : "Ativar prévia"}
                </button>
              </div>

              <div className="settings-field">
                <label><i className="bi bi-camera-video" /> Câmera</label>
                <select onChange={(e) => onSwitchCamera(e.target.value)} defaultValue="">
                  <option value="" disabled>Selecione uma câmera</option>
                  {devices.cameras.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || "Câmera"}</option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label><i className="bi bi-mic-fill" /> Microfone</label>
                <select onChange={(e) => onSwitchMicrophone(e.target.value)} defaultValue="">
                  <option value="" disabled>Selecione um microfone</option>
                  {devices.microphones.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || "Microfone"}</option>
                  ))}
                </select>
                <div className="mic-meter-wrap">
                  <i className="bi bi-soundwave" />
                  <div className="mic-meter">
                    <div className="mic-meter-fill" style={{ width: `${micLevel}%` }} />
                  </div>
                  <span className="mic-level-label">{micLevel}%</span>
                </div>
              </div>

              {devices.speakers.length > 0 && (
                <div className="settings-field">
                  <label><i className="bi bi-volume-up-fill" /> Saída de áudio</label>
                  <select onChange={(e) => onSpeakerChange(e.target.value)} defaultValue="">
                    <option value="" disabled>Selecione a saída</option>
                    {devices.speakers.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || "Alto-falante"}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {activeTab === "call" && (
            <>
              <div className="settings-field">
                <label><i className="bi bi-stars" /> Qualidade de vídeo</label>
                <div className="settings-radio-group">
                  {[["baixa", "Baixa", "bi-reception-1"], ["media", "Média", "bi-reception-3"], ["alta", "Alta", "bi-reception-4"]].map(([val, label, icon]) => (
                    <button
                      key={val}
                      type="button"
                      className={`settings-radio-btn ${settings.quality === val ? "active" : ""}`}
                      onClick={() => onSettingChange("quality", val)}
                    >
                      <i className={`bi ${icon}`} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-field">
                <label><i className="bi bi-layout-three-columns" /> Layout</label>
                <div className="settings-radio-group">
                  {[["grid", "Grade", "bi-grid-fill"], ["single", "1×1", "bi-square-fill"], ["focus", "Foco", "bi-layout-sidebar-inset"]].map(([val, label, icon]) => (
                    <button
                      key={val}
                      type="button"
                      className={`settings-radio-btn ${settings.layout === val ? "active" : ""}`}
                      onClick={() => onSettingChange("layout", val)}
                    >
                      <i className={`bi ${icon}`} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-field">
                <label><i className="bi bi-speedometer2" /> Performance</label>
                <div className="settings-toggle-row">
                  <span>Modo economia de energia</span>
                  <button
                    type="button"
                    className={`settings-toggle-switch ${settings.performanceMode ? "active" : ""}`}
                    onClick={() => onSettingChange("performanceMode", !settings.performanceMode)}
                    aria-pressed={settings.performanceMode}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "appearance" && (
            <>
              <div className="settings-field">
                <label><i className="bi bi-moon-stars-fill" /> Tema</label>
                <div className="settings-radio-group">
                  {[["dark", "Escuro", "bi-moon-fill"], ["light", "Claro", "bi-sun-fill"]].map(([val, label, icon]) => (
                    <button
                      key={val}
                      type="button"
                      className={`settings-radio-btn ${settings.themeMode === val ? "active" : ""}`}
                      onClick={() => onSettingChange("themeMode", val)}
                    >
                      <i className={`bi ${icon}`} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="settings-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            <i className="bi bi-check-lg" /> Salvar e fechar
          </button>
        </div>
      </div>
    </div>
  );
}
