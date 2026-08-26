import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../services/api.js";
import { validateName } from "../utils/format.js";
import { useAuth } from "../hooks/useAuth.jsx";
import ThemePicker from "../components/ThemePicker.jsx";

const FEATURES = [
  {
    icon: "bi-camera-video-fill",
    title: "Vídeo em tempo real",
    desc: "Chamadas fluidas direto do navegador, sem instalar nada.",
  },
  {
    icon: "bi-mic-fill",
    title: "Áudio nítido",
    desc: "Cancelamento de ruído e ajuste automático de ganho.",
  },
  {
    icon: "bi-display",
    title: "Compartilhamento de tela",
    desc: "Mostre sua tela inteira, uma janela ou uma aba do navegador.",
  },
  {
    icon: "bi-link-45deg",
    title: "Convites por link",
    desc: "Crie a sala e envie um link. Ninguém precisa criar conta.",
  },
];

export default function Home() {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Preenche o nome automaticamente se estiver logado
  const effectiveName = user ? user.name : name;

  async function handleCreateRoom(e) {
    e.preventDefault();
    const validationError = validateName(effectiveName);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { roomId } = await createRoom();
      navigate(`/room/${roomId}`, { state: { name: effectiveName.trim() } });
    } catch {
      setError("Não foi possível criar a sala. Verifique se o servidor está rodando.");
      setLoading(false);
    }
  }

  return (
    <div className="home">
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob b1" />
        <div className="aurora-blob b2" />
        <div className="aurora-blob b3" />
        <div className="aurora-grid" />
      </div>

      <header className="home-header">
        <div className="brand">
          <span className="brand-mark">
            <i className="bi bi-broadcast" />
          </span>
          Nexa
        </div>
        <ThemePicker />
        <nav>
          <a href="#features">Recursos</a>
          {user ? (
            <div className="header-user">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="header-avatar" />
                : <div className="header-avatar-initials">{user.name.slice(0, 2).toUpperCase()}</div>
              }
              <span className="header-username">{user.name}</span>
              <a href="/dashboard" className="btn-ghost-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <i className="bi bi-grid" /> Painel
              </a>
              <button className="btn-ghost-sm" onClick={logout}>Sair</button>
            </div>
          ) : (
            <a href="/auth" className="btn btn-ghost" style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
              <i className="bi bi-person-circle" /> Entrar
            </a>
          )}
        </nav>
      </header>

      <main className="hero">
        <div className="hero-eyebrow">
          <span className="dot" />
          Funciona 100% no navegador
        </div>

        <h1>
          Converse. Compartilhe. <span className="gradient-word">Conecte-se.</span>
        </h1>

        <p className="hero-subtitle">
          Crie uma chamada de vídeo e áudio em segundos. Digite seu nome, gere uma sala e
          convide quem quiser com um único link.
        </p>

        <form className="hero-form glass-card" onSubmit={handleCreateRoom}>
          <div className="input-row">
            <div className="name-input-wrap">
              <i className="bi bi-person" />
              {user ? (
                <span style={{ flex: 1, padding: "14px 0", color: "var(--text-primary)" }}>{user.name}</span>
              ) : (
                <input
                  type="text"
                  placeholder="Como podemos te chamar?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  autoFocus
                />
              )}
            </div>
          </div>

          {error && <div className="error-text">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <i className="bi bi-arrow-repeat" /> Criando sala...
              </>
            ) : (
              <>
                <i className="bi bi-plus-circle-fill" /> Criar sala
              </>
            )}
          </button>

          <span className="hero-hint">Você poderá copiar o link e enviar para seus amigos.</span>
        </form>
      </main>

      <section className="features" id="features">
        {FEATURES.map((f) => (
          <div className="feature-card glass-card" key={f.title}>
            <div className="feature-icon">
              <i className={`bi ${f.icon}`} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="home-footer">Nenhum dado de chamada é salvo. As salas existem apenas enquanto estiverem ativas.</footer>
    </div>
  );
}
