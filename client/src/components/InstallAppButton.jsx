import { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState(() => window.nexInstallPrompt || null);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event) => { event.preventDefault(); window.nexInstallPrompt = event; setInstallEvent(event); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!installEvent) {
      setShowHelp(true);
      return;
    }
    installEvent.prompt();
    await installEvent.userChoice;
    window.nexInstallPrompt = null;
    setInstallEvent(null);
  }

  if (installed) return <span className="app-installed"><i className="bi bi-check2-circle" /> App instalado</span>;
  return (
    <div className="install-app-wrap">
      <button type="button" className="btn-ghost-sm install-app-button" onClick={install}>
        <i className="bi bi-download" /> Usar como app
      </button>
      {showHelp && (
        <div className="install-app-help" role="status">
          {navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad")
            ? "No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”."
            : "Abra o menu do navegador e escolha “Instalar Nex” ou “Adicionar à tela inicial”."}
        </div>
      )}
    </div>
  );
}
