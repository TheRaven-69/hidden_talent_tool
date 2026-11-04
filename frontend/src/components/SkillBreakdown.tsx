import { SkillBreakdownItem } from "../api/client";

const COLORS = { explicit: "#285f3a", inferred: "var(--focus)", missing: "var(--muted)" };
const STATUS_LABELS = { explicit: "Supported by CV", inferred: "Suggested by experience", missing: "Not found in CV" };
const WEIGHT_LABELS = { must: "Must-have", nice: "Nice-to-have" };

export default function SkillBreakdown({ items, showWeights = true }: { items: SkillBreakdownItem[]; showWeights?: boolean }) {
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {items.map((i) => (
        <li key={i.concept_id} style={{ marginBottom: 6 }}>
          <strong>{i.label}</strong>{showWeights && <> ({WEIGHT_LABELS[i.weight]})</>}{" "}
          <span style={{ color: COLORS[i.status] }}>{STATUS_LABELS[i.status]}</span>
          {i.evidence && <em> – “{i.evidence}”</em>}
        </li>
      ))}
    </ul>
  );
}
