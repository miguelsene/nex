import { useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { login, register } from "../services/auth.js";
import { useAuth } from "../hooks/useAuth.jsx";
import ThemePicker from "../components/ThemePicker.jsx";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const { user, login: setSession } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/dashboard" replace />;

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 80;
        canvas.height = 80;
        const ctx = canvas.getContext("2d");
        // Crop quadrado centralizado
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 80, 80);
        setAvatar(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError("Preencha e-mail e senha."); return; }
    if (mode === "register" && !name.trim()) { setError("Digite seu nome."); return; }
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }

    setLoading(true);
    const result = mode === "login"
      ? await login({ email, password })
      : await register({ name, email, password, avatarDataUrl: avatar });
    setLoading(false);

    if (!result.ok) { setError(result.error); return; }
    setSession(result.user);
    navigate("/dashboard", { replace: true });
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
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="brand-mark"><i className="bi bi-broadcast" /></span>
          Nexa
        </a>
        <ThemePicker />
        <button className="btn-ghost-sm" onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="bi bi-arrow-left" /> Voltar
        </button>
      </header>

      <main className="hero" style={{ justifyContent: "center" }}>
        <form className="hero-form glass-card auth-form" onSubmit={handleSubmit}>
          <div className="auth-tabs">
            <button type="button" className={mode === "login" ? "auth-tab active" : "auth-tab"} onClick={() => { setMode("login"); setError(null); }}>
              Entrar
            </button>
            <button type="button" className={mode === "register" ? "auth-tab active" : "auth-tab"} onClick={() => { setMode("register"); setError(null); }}>
              Criar conta
            </button>
          </div>

          {mode === "register" && (
            <>
              <div className="avatar-upload-wrap" onClick={() => fileRef.current?.click()}>
                {avatar
                  ? <img src={avatar} alt="avatar" className="avatar-upload-preview" />
                  : <div className="avatar-upload-placeholder"><i className="bi bi-camera-fill" /><span>Foto de perfil</span></div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />

              <div className="name-input-wrap">
                <i className="bi bi-person" />
                <input type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
              </div>
            </>
          )}

          <div className="name-input-wrap">
            <i className="bi bi-envelope" />
            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={mode === "login"} />
          </div>

          <div className="name-input-wrap">
            <i className="bi bi-lock" />
            <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><i className="bi bi-arrow-repeat" /> Aguarde...</> : mode === "login" ? <><i className="bi bi-box-arrow-in-right" /> Entrar</> : <><i className="bi bi-person-plus-fill" /> Criar conta</>}
          </button>
        </form>
      </main>
    </div>
  );
}
