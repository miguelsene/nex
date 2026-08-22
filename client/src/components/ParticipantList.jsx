import { getInitials } from "../utils/format.js";

export default function ParticipantList({ self, remoteParticipants, onClose }) {
  const total = remoteParticipants.length + 1;

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h3>{total} participante{total !== 1 ? "s" : ""}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar painel">
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="participant-list">
        <ParticipantRow participant={self} isSelf />
        {remoteParticipants.map((p) => (
          <ParticipantRow key={p.id} participant={p} />
        ))}
      </div>
    </div>
  );
}

function ParticipantRow({ participant, isSelf }) {
  return (
    <div className="participant-row">
      <div className="avatar-circle">{getInitials(participant.name)}</div>
      <div className="p-info">
        <div className="p-name">
          {participant.name} {isSelf && "(você)"}
        </div>
        {participant.isSharingScreen && <div className="p-tag">Compartilhando tela</div>}
      </div>
      <div className="p-status">
        <i className={`bi ${participant.micOn ? "bi-mic-fill" : "bi-mic-mute-fill"} ${!participant.micOn ? "off" : ""}`} />
        <i className={`bi ${participant.camOn ? "bi-camera-video-fill" : "bi-camera-video-off-fill"} ${!participant.camOn ? "off" : ""}`} />
      </div>
    </div>
  );
}
