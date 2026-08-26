import VideoCard from "./VideoCard.jsx";

export default function VideoGrid({ self, remoteParticipants, speakerId }) {
  const all = [self, ...remoteParticipants];
  const count = all.length;

  return (
    <div className="video-grid" data-count={Math.min(count, 9)}>
      {all.map((p) => (
        <VideoCard
          key={p.id}
          stream={p.stream}
          name={p.name}
          avatar={p.avatar || null}
          isLocal={p.isLocal}
          micOn={p.micOn}
          camOn={p.camOn}
          isSharingScreen={p.isSharingScreen}
          speaking={p.speaking}
          speakerId={speakerId}
        />
      ))}
    </div>
  );
}
