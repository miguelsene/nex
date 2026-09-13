import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../services/socket.js";

// Garante UM socket conectado por página. Conecta no mount,
// NÃO desconecta no unmount (minimizar/navegar dentro do app
// não deve derrubar a sinalização no meio da chamada).
export function useCallSocket() {
  const ref = useRef(null);
  const [state, setState] = useState("connecting");
  if (!ref.current) ref.current = getSocket();

  useEffect(() => {
    const s = ref.current;
    const on = () => setState("connected");
    const off = () => setState("lost");
    const err = () => setState("lost");
    s.on("connect", on);
    s.on("disconnect", off);
    s.on("connect_error", err);
    s.io.on("reconnect", on);
    if (!s.connected) s.connect(); else setState("connected");
    return () => {
      s.off("connect", on);
      s.off("disconnect", off);
      s.off("connect_error", err);
      s.io.off("reconnect", on);
    };
  }, []);

  const leave = useCallback(() => {
    try { ref.current.emit("leave-room"); } catch { /* noop */ }
  }, []);

  return { socket: ref.current, state, leave };
}
