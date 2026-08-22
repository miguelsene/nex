/**
 * Monta a lista de iceServers a partir de variáveis de ambiente.
 * Em desenvolvimento, apenas o STUN público é usado.
 * Em produção, preencha TURN_URL / TURN_USERNAME / TURN_CREDENTIAL no .env
 * para garantir conectividade atrás de NAT simétrico / firewalls restritivos.
 */
export function getIceServers() {
  const iceServers = [
    { urls: process.env.STUN_URL || "stun:stun.l.google.com:19302" },
  ];

  const turnUrl = process.env.TURN_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return iceServers;
}
