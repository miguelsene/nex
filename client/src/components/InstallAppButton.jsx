import { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState(() => window.nexInstallPrompt || null);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);

  useEffect(() => {
    const onBeforeInstall = (event) => { event.preventDefault(); window.nexInstallPrompt = event; setInstallEvent(event); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    window.nexInstallPrompt = null;
    setInstallEvent(null);
  }

  if (installed) return <span className="app-installed"><i className="bi bi-check2-circle" /> App instalado</span>;
  if (!installEvent) return null;
  return <button type="button" className="btn-ghost-sm install-app-button" onClick={install}><i className="bi bi-download" /> Usar como app</button>;
}
