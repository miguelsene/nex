import VideoCard from "./VideoCard.jsx";

export default function VideoGrid({
  self,
  remoteParticipants,
  speakerId,
  pinnedId = null,
  participantVolumes = {},
  onTogglePin,
  onOpenParticipantMenu,
}) {
  const all = [self, ...remoteParticipants];
  const count = all.length;
  const pinned = pinnedId ? all.find((p) => p.id === pinnedId) : null;
  const visible = pinned ? [pinned, ...all.filter((p) => p.id !== pinned.id)] : all;

  return (
    <div className={["video-grid", pinned ? "has-pinned" : ""].filter(Boolean).join(" ")} data-count={Math.min(count, 9)}>
      {visible.map((p, index) => (
        <VideoCard
          key={p.id}
          id={p.id}
          stream={p.stream}
          name={p.name}
          avatar={p.avatar || null}
          isLocal={p.isLocal}
          micOn={p.micOn}
          camOn={p.camOn}
          isSharingScreen={p.isSharingScreen}
          speaking={p.speaking}
          speakerId={speakerId}
          volume={participantVolumes[p.id] ?? 1}
          isPinned={pinned?.id === p.id}
          compact={Boolean(pinned && index > 0)}
          onTogglePin={() => onTogglePin?.(p.id)}
          onOpenMenu={onOpenParticipantMenu}
        />
      ))}
    </div>
  );
}
