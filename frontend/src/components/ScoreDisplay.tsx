export default function ScoreDisplay({ label, value }: { label: string; value?: number | null }) {
  const pct = value == null ? "–" : `${Math.round(value * 100)}%`;
  return (
    <span style={{ marginRight: 16 }}>
      {label}: <strong>{pct}</strong>
    </span>
  );
}
