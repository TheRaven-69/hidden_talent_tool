import { SkillBreakdownItem } from "../api/client";

const COLORS = { explicit: "#2e7d32", inferred: "#ed6c02", missing: "#9e9e9e" };

export default function SkillBreakdown({ items }: { items: SkillBreakdownItem[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {items.map((i) => (
        <li key={i.concept_id} style={{ marginBottom: 6 }}>
          <strong>{i.label}</strong> ({i.weight}){" "}
          <span style={{ color: COLORS[i.status] }}>{i.status}</span>
          {i.evidence && <em> – “{i.evidence}”</em>}
        </li>
      ))}
    </ul>
  );
}
