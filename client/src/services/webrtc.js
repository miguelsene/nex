/**
 * Cria e configura um RTCPeerConnection para um par remoto específico.
 *
 * callbacks:
 *  - onIceCandidate(candidate)
 *  - onTrack(event)          -> disparado quando uma track remota chega
 *  - onConnectionStateChange(state)
 *  - onNegotiationNeeded()   -> quem chama decide se cria uma offer (só o "polite" lado deveria, ver useWebRTC)
 */
export function createPeerConnection(iceServers, callbacks = {}) {
  const pc = new RTCPeerConnection({
    iceServers: iceServers && iceServers.length ? iceServers : [
      { urls: "stun:stun.l.google.com:19302" },
    ],
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callbacks.onIceCandidate?.(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    callbacks.onTrack?.(event);
  };

  pc.onconnectionstatechange = () => {
    callbacks.onConnectionStateChange?.(pc.connectionState);
  };

  pc.onnegotiationneeded = () => {
    callbacks.onNegotiationNeeded?.();
  };

  return pc;
}

/**
 * Aplica preferência por Opus e bitrate alto no SDP para melhorar qualidade de áudio.
 */
export function optimizeAudioSdp(sdp) {
  // Garante que Opus seja o codec preferido e configura parâmetros
  return sdp
    .replace(/a=fmtp:(\d+) (.*)\r\n/g, (match, pt, params) => {
      if (sdp.includes(`a=rtpmap:${pt} opus`)) {
        const base = params.replace(/stereo=\d/, "").replace(/maxaveragebitrate=\d+/, "").replace(/;;/g, ";").replace(/^;|;$/g, "");
        return `a=fmtp:${pt} ${base ? base + ";" : ""}stereo=0;maxaveragebitrate=128000\r\n`;
      }
      return match;
    });
}

/**
 * Substitui (ou adiciona) a track de um determinado tipo ("video"/"audio")
 * em todos os RTCRtpSenders de uma conexão, usada para trocar câmera <-> compartilhamento de tela
 * sem precisar renegociar a conexão inteira.
 */
export function replaceTrack(pc, kind, newTrack) {
  const sender = pc.getSenders().find((s) => s.track && s.track.kind === kind);
  if (sender) {
    return sender.replaceTrack(newTrack);
  }
  return null;
}

export function addOrReplaceTrack(pc, stream, track) {
  const existingSender = pc.getSenders().find((s) => s.track && s.track.kind === track.kind);
  if (existingSender) {
    return existingSender.replaceTrack(track);
  }
  return pc.addTrack(track, stream);
}
