import type { CSSProperties } from "react";

type Props = {
  name: string;
  color: string;
  url?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function PlayerAvatar({ name, color, url, size = 40, className, style }: Props) {
  const dim = { width: size, height: size, minWidth: size, minHeight: size };
  const base: CSSProperties = {
    ...dim,
    borderRadius: "9999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    overflow: "hidden",
    boxShadow: `0 0 0 2px ${color}`,
    ...style,
  };
  if (url) {
    return (
      <span className={className} style={base}>
        <img
          src={url}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
      </span>
    );
  }
  return (
    <span
      className={className}
      style={{ ...base, background: color, color: "#0A0A0C", fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
