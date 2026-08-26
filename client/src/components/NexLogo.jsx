export default function NexLogo({ size = 32 }) {
  return (
    <img
      src="/nex.png"
      alt="Nex"
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}
