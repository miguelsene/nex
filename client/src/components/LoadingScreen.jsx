import { useEffect, useState } from "react";

const RPG_TIPS = [
  "Preparando sua próxima aventura...",
  "Reunindo o grupo para a campanha...",
  "Afiando espadas e testando microfones...",
  "Os dados já estão rolando na mesa...",
  "Carregando mapas, histórias e grandes encontros...",
];

export default function LoadingScreen({ message }) {
  const [tip, setTip] = useState(0);

  useEffect(() => {
    if (message) return undefined;
    const interval = window.setInterval(() => setTip((current) => (current + 1) % RPG_TIPS.length), 2600);
    return () => window.clearInterval(interval);
  }, [message]);

  return (
    <main className="app-loader" role="status" aria-live="polite">
      <div className="app-loader__glow" aria-hidden="true" />
      <img className="app-loader__logo" src="/nex.png" alt="Nex" />
      <h1>Nex</h1>
      <div className="app-loader__bar" aria-hidden="true"><span /></div>
      <p>{message || RPG_TIPS[tip]}</p>
    </main>
  );
}
