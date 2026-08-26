import { THEMES, useTheme } from "../hooks/useTheme.js";

export default function ThemePicker() {
  const { activeId, setTheme } = useTheme();

  return (
    <div className="theme-picker" aria-label="Escolher tema">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-dot${activeId === t.id ? " active" : ""}`}
          style={{ "--dot-color": t.dot }}
          onClick={() => setTheme(t.id)}
          title={t.id.charAt(0).toUpperCase() + t.id.slice(1)}
          aria-pressed={activeId === t.id}
        />
      ))}
    </div>
  );
}
