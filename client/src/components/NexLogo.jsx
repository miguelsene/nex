export default function NexLogo({ size = 32 }) {
  return (
    <img
      src="/logo.svg"
      alt="Nex"
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}
