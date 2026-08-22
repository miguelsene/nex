import { useEffect, useRef, useState } from "react";
import { getSocket } from "../services/socket.js";

/**
 * Conecta ao servidor de sinalização assim que o componente monta e
 * desconecta ao desmontar. Expõe o estado da conexão para a UI.
 */
export function useSocket() {
  const socketRef = useRef(getSocket());
  const [connectionState, setConnectionState] = useState("connecting"); // connecting | connected | lost

  useEffect(() => {
    const socket = socketRef.current;

    function handleConnect() {
      setConnectionState("connected");
    }
    function handleDisconnect() {
      setConnectionState("lost");
    }
    function handleReconnectAttempt() {
      setConnectionState("connecting");
    }
    function handleConnectError(error) {
      console.error("Socket.IO connection failed:", error?.message || error);
      setConnectionState("lost");
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect", handleConnect);

    if (!socket.connected) {
      socket.connect();
    } else {
      setConnectionState("connected");
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.io.off("reconnect", handleConnect);
      socket.emit("leave-room");
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connectionState };
}
