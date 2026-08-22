export function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function validateName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Digite seu nome para continuar.";
  if (trimmed.length < 2) return "O nome precisa ter pelo menos 2 caracteres.";
  if (trimmed.length > 40) return "O nome pode ter no máximo 40 caracteres.";
  return null;
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildInviteUrl(roomId) {
  return `${window.location.origin}/room/${roomId}`;
}
