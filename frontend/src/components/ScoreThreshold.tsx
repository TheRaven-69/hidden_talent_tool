import type { CSSProperties } from "react";
import "./score-threshold.css";

export default function ScoreThreshold({ id, kind, value, disabled, onChange }: {
  id: string;
  kind: "entry" | "target";
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const percent = Math.round(value * 100);
  const level = percent < 40 ? "low" : percent < 70 ? "medium" : "high";
  const entry = kind === "entry";
  const label = entry ? "CV match to start assessment" : "Target assessment score";
  const tone = entry
    ? percent === 0 ? "No minimum score" : percent === 100 ? "Full match required" : level === "low" ? "Broader access" : level === "medium" ? "Moderate minimum" : "Closer match required"
    : percent === 0 ? "No minimum target" : percent === 100 ? "Full score target" : level === "low" ? "Lower target" : level === "medium" ? "Moderate target" : "Higher target";
  const update = (raw: string) => {
    if (raw === "") return;
    const next = Number(raw);
    if (Number.isFinite(next)) onChange(Math.min(100, Math.max(0, Math.round(next))) / 100);
  };
  return <section className={`score-threshold score-threshold-${level}`} style={{ "--score-fill": `${percent}%` } as CSSProperties}>
    <div className="score-threshold-heading"><label htmlFor={id}>{label}</label><span className="score-threshold-badge">{entry ? "Controls access" : "Reference only"}</span></div>
    <div className="score-threshold-value"><output htmlFor={id}>{percent}<span>%</span></output><span className="score-threshold-tone">{tone}</span></div>
    <input className="score-threshold-slider" id={id} type="range" min={0} max={100} step={1} value={percent} disabled={disabled} onChange={e => update(e.target.value)} aria-valuetext={`${percent} percent, ${tone}`} aria-describedby={`${id}-help`} />
    <div className="score-threshold-scale" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
    <div className="score-threshold-controls"><div className="score-threshold-presets" role="group" aria-label={`${label}: quick values`}>
      {(entry ? [30, 50, 70] : [50, 70, 90]).map(preset => <button type="button" key={preset} disabled={disabled} aria-pressed={percent === preset} onClick={() => onChange(preset / 100)}>{preset}%</button>)}
    </div><label className="score-threshold-exact">Exact value <span><input aria-label={`${label}: exact percentage`} type="number" min={0} max={100} step={1} value={percent} disabled={disabled} onChange={e => update(e.target.value)} />%</span></label></div>
    <div className="score-threshold-effect" id={`${id}-help`}>
      <strong>{entry ? "What this means" : "Your review benchmark"}</strong>
      <p>{entry ? percent === 0 ? "All applicants can start the assessment, regardless of their CV match score." : `A CV match of ${percent}% or higher allows the candidate to start the assessment. Lower-scoring applications remain available for your review.`
        : `Your target is ${percent}% on the assessment. This value is saved for reference; it does not currently mark candidates as passed or failed.`}</p>
    </div>
  </section>;
}
