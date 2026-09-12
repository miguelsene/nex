import { useEffect, useRef, useState } from "react";
import { getSocket } from "../services/socket.js";

export function useSocket() {
  // Sempre pega o socket atual — se foi resetado, getSocket() cria um novo
  const socketRef = useRef(null);
  const [connectionState, setConnectionState] = useState("connecting");

  // Garante que o ref aponta para o socket correto a cada render
  const currentSocket = getSocket();
  if (socketRef.current !== currentSocket) {
    socketRef.current = currentSocket;
  }

  useEffect(() => {
    const socket = socketRef.current;

    function handleConnect() { setConnectionState("connected"); }
    function handleDisconnect() { setConnectionState("lost"); }
    function handleReconnectAttempt() { setConnectionState("connecting"); }
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef.current]);

  return { socket: socketRef.current, connectionState };
}
