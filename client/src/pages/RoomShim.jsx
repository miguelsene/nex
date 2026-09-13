import { useNavigate, useParams } from "react-router-dom";
import CallRoom from "./CallRoom.jsx";

// Mantém a rota /room/:roomId funcionando enquanto a nova
// página é construída em CallRoom.jsx (migração por etapas).
export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  return <CallRoom roomId={roomId} navigate={navigate} />;
}
export { CallExperience } from "./CallRoom.jsx";
