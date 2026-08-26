import { getInitials } from "../utils/format.js";

export default function ParticipantList({ self, remoteParticipants, onClose, onAddFriend }) {
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
          <ParticipantRow key={p.id} participant={p} onAddFriend={onAddFriend} />
        ))}
      </div>
    </div>
  );
}

function ParticipantRow({ participant, isSelf, onAddFriend }) {
  return (
    <div className="participant-row">
      {participant.avatar
        ? <img src={participant.avatar} alt={participant.name} className="avatar-circle" style={{ objectFit: "cover" }} />
        : <div className="avatar-circle">{getInitials(participant.name)}</div>
      }
      <div className="p-info">
        <div className="p-name">
          {participant.name} {isSelf && <span style={{ color: "var(--accent-cyan)", fontSize: "0.75rem" }}>(você)</span>}
        </div>
        {participant.isSharingScreen && <div className="p-tag">Compartilhando tela</div>}
      </div>
      <div className="p-status">
        <i className={`bi ${participant.micOn ? "bi-mic-fill" : "bi-mic-mute-fill"} ${!participant.micOn ? "off" : ""}`} />
        <i className={`bi ${participant.camOn ? "bi-camera-video-fill" : "bi-camera-video-off-fill"} ${!participant.camOn ? "off" : ""}`} />
        {!isSelf && onAddFriend && (
          <button
            className="icon-btn"
            title="Enviar pedido de amizade"
            onClick={() => onAddFriend(participant)}
            style={{ marginLeft: 4 }}
          >
            <i className="bi bi-person-plus-fill" style={{ color: "var(--accent-cyan)", fontSize: "0.85rem" }} />
          </button>
        )}
      </div>
    </div>
  );
}
