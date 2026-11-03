import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, JobSkill } from "../../api/client";

export default function CreateJob() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [adText, setAdText] = useState("");
  const [skills, setSkills] = useState<JobSkill[]>([]);
  const [gate, setGate] = useState(0.5);
  const [pass, setPass] = useState(0.7);
  const [busy, setBusy] = useState(false);

  const suggest = async () => {
    setBusy(true);
    try { setSkills((await api.suggestSkills(adText)).skills); } finally { setBusy(false); }
  };
  const toggle = (i: number) =>
    setSkills(skills.map((s, k) => (k === i ? { ...s, weight: s.weight === "must" ? "nice" : "must" } : s)));
  const publish = async () => {
    const job = await api.createJob({
      id: "", title, location: "", ad_text: adText, skills, gate, pass_threshold: pass,
    });
    nav(`/employer/jobs/${job.id}/candidates`);
  };

  return (
    <div>
      <h2>Create job</h2>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea rows={10} style={{ width: "100%" }} placeholder="Job ad text"
        value={adText} onChange={(e) => setAdText(e.target.value)} />
      <button onClick={suggest} disabled={busy || !adText}>{busy ? "Analysing…" : "Suggest skills"}</button>
      <ul>
        {skills.map((s, i) => (
          <li key={s.concept_id}>{s.label} – <button onClick={() => toggle(i)}>{s.weight}</button></li>
        ))}
      </ul>
      <label>Assessment gate {Math.round(gate * 100)}%
        <input type="range" min={0} max={1} step={0.05} value={gate} onChange={(e) => setGate(+e.target.value)} />
      </label>
      <label>Pass threshold {Math.round(pass * 100)}%
        <input type="range" min={0} max={1} step={0.05} value={pass} onChange={(e) => setPass(+e.target.value)} />
      </label>
      <button onClick={publish} disabled={!title || skills.length === 0}>Publish</button>
    </div>
  );
}
