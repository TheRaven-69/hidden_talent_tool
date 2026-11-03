import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Recommendations as Result } from "../../api/client";
import SkillBreakdown from "../../components/SkillBreakdown";
import "./recommendations.css";

export default function Recommendations() {
  const [candidates, setCandidates] = useState<{ id: string; background_text?: string }[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [cv, setCv] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.candidates().then(setCandidates).catch(() => setError("Could not load demo profiles. Try reloading.")); }, []);
  const submit = async () => {
    setBusy(true); setError(""); setResult(null);
    try { setResult(await api.recommend(candidateId ? { candidate_id: candidateId } : { cv_text: cv })); }
    catch { setError("Could not prepare recommendations. Please try again."); }
    finally { setBusy(false); }
  };
  const profile = candidates.find(c => c.id === candidateId);
  const explicit = result?.skills.filter(s => s.confidence === "explicit") || [];
  const inferred = result?.skills.filter(s => s.confidence === "inferred") || [];
  return <div className="recommendations-page">
    <header className="page-heading">
      <p className="eyebrow">Candidate workspace</p>
      <h1>See where your experience can take you.</h1>
      <p>Discover relevant work through the skills behind your experience — including skills you may not have named yourself.</p>
    </header>
    <ol className="journey" aria-label="Application journey">
      <li aria-current={!result ? "step" : undefined}><span>1</span> Your experience</li>
      <li aria-current={result ? "step" : undefined}><span>2</span> Explore matches</li>
      <li><span>3</span> Apply &amp; assess</li>
    </ol>
    <div className="workspace">
      <aside className="profile-panel">
        <p className="eyebrow">Start here</p><h2>Your experience</h2>
        <p className="muted">Choose a fictional profile or describe a fictional candidate's experience.</p>
        <label htmlFor="demo-profile">Demo profile</label>
        <select id="demo-profile" value={candidateId} disabled={busy} onChange={e => { setCandidateId(e.target.value); setResult(null); }}>
          <option value="">Enter fictional CV text</option>
          {candidates.map(c => <option key={c.id} value={c.id}>{c.id} — {c.background_text?.slice(0, 65)}</option>)}
        </select>
        {candidateId ? <div className="profile-text"><span className="eyebrow">Background</span><p>{profile?.background_text || "Profile text unavailable."}</p></div> :
          <><label htmlFor="fictional-cv">Fictional CV text</label><textarea id="fictional-cv" rows={9} value={cv} disabled={busy} placeholder="Describe tasks, projects and practical experience…" onChange={e => { setCv(e.target.value); setResult(null); }} /></>}
        <button className="primary-action" disabled={busy || (!candidateId && !cv.trim())} onClick={submit}>{busy ? "Analysing experience…" : "Find matching jobs →"}</button>
        <p className="small muted">Demo profiles only. Use fictional information.</p>
        {error && <p className="error-notice" role="alert">{error}</p>}
      </aside>
      <section className="results-panel" aria-busy={busy} aria-label="Skills and job recommendations">
        {busy && <div className="empty-panel" role="status"><span className="loading-indicator" aria-hidden="true" /><h2>Connecting your skills to opportunities</h2><p>We’re identifying evidence in your experience and comparing job requirements. The first analysis can take several minutes.</p><p className="muted">Keep this page open. Your results will appear here.</p></div>}
        {!busy && !result && <div className="empty-panel"><p className="eyebrow">Experience → skills → opportunities</p><h2>More than a previous job title.</h2><p>Start with your experience to see which skills it demonstrates and where those skills could transfer.</p><dl className="preview-explanation"><div><dt>Evidence you can inspect</dt><dd>Every identified skill includes a quote from the profile.</dd></div><div><dt>Gaps you can understand</dt><dd>See what matches and what still needs confirmation.</dd></div><div><dt>A clear next step</dt><dd>Review the role and understand what happens after applying.</dd></div></dl></div>}
        {result && <>
          <section className="skills-panel">
            <div className="section-heading"><div><p className="eyebrow">01 / Your skill profile</p><h2>What your experience shows</h2></div><span className="count-label">{result.skills.length} skills identified</span></div>
            <p className="muted">AI suggestions with original evidence. Review these mappings: they can contain mistakes. Skill names follow the Swedish taxonomy.</p>
            {[{title: "Stated in your experience", items: explicit, kind: "explicit", description: "Skills identified directly from the profile."}, {title: "Potential transferable skills", items: inferred, kind: "inferred", description: "Inferred from your activities; these need confirmation."}].map(group => group.items.length > 0 && <div className="skill-group" key={group.kind}>
              <h3>{group.title} <span className="count-label">{group.items.length}</span></h3><p className="small muted">{group.description}</p>
              {group.items.map(s => <details className="skill-evidence" key={s.concept_id}><summary><span className={`status-dot ${group.kind}`} aria-hidden="true" />{s.label}<span className="evidence-hint">View evidence</span></summary><blockquote>{s.evidence}</blockquote></details>)}
            </div>)}
            {!result.skills.length && <p>No taxonomy skills could be identified. Add specific examples of tasks you have done.</p>}
          </section>
          <section className="matches-section">
            <div className="section-heading"><div><p className="eyebrow">02 / Opportunities</p><h2>Jobs to explore <span className="count-label">{result.recommendations.length}</span></h2></div><Link to="/">Browse all jobs →</Link></div>
            <p className="muted">Ranked within {result.evaluated_count} evaluated jobs. This is a shortlist, not a comparison of every vacancy.</p>
            <p className="snapshot-note">Demo snapshot · Some vacancies may have expired. Qualifications require review; a score does not verify licences or eligibility.</p>
            {!result.recommendations.length && <div className="empty-panel compact"><h3>No shared skills found yet</h3><p>{result.skills.length ? "The evaluated jobs did not share identified skills with this profile. Try adding more concrete experience or browse other vacancies." : "Add more practical experience to build your skill profile first."}</p><Link to="/">Explore all vacancies →</Link></div>}
            {result.recommendations.map((r, index) => {
              const matched = r.skill_breakdown.filter(s => s.status !== "missing");
              const gaps = r.skill_breakdown.filter(s => s.status === "missing");
              const score = Math.round(r.match_score * 100);
              return <article className="job-match" key={r.job.id}>
                <div className="job-topline"><span className="eyebrow">Match {String(index + 1).padStart(2, "0")}</span><span className={`gate-status ${r.meets_score_gate ? "eligible" : "below"}`}>{r.meets_score_gate ? "Assessment available after applying" : "Employer review"}</span></div>
                <div className="job-heading"><div><h3>{r.job.title}</h3><p className="muted">{r.job.location || "Location not specified"}</p></div><div className="match-score"><strong>{score}<span>%</span></strong><span>CV match</span></div></div>
                <div className="match-meter" role="img" aria-label={`CV match ${score} percent.`}><span style={{ width: `${score}%` }} /></div>
                <div className="meter-caption"><span>CV match {score}%</span></div>
                <div className="match-summary"><div><h4>Evidence of a match · {matched.length}</h4>{matched.length ? <ul>{matched.map(s => <li key={s.concept_id}>{s.label}{s.status === "inferred" && <span className="inferred-label"> · inferred</span>}</li>)}</ul> : <p>No skill evidence found.</p>}</div><div><h4>Not evidenced in this CV · {gaps.length}</h4>{gaps.length ? <ul>{gaps.map(s => <li key={s.concept_id}>{s.label}</li>)}</ul> : <p>All listed skills have some supporting evidence.</p>}</div></div>
                <details className="job-details"><summary>Inspect skill evidence and requirements</summary><SkillBreakdown items={r.skill_breakdown} showWeights={false} /><h4>Original job description</h4><p className="job-description">{r.job.ad_text}</p></details>
                <footer className="job-footer"><p>{r.meets_score_gate ? "Applying can lead to a tailored assessment. The employer makes the final decision." : "You can submit your experience for the employer to review."}</p><Link className={r.meets_score_gate ? "primary-action" : "secondary-action"} to={`/jobs/${encodeURIComponent(r.job.id)}/apply?candidate_id=${encodeURIComponent(result.candidate_id)}`}>Review &amp; apply →</Link></footer>
              </article>;
            })}
          </section>
        </>}
      </section>
    </div>
  </div>;
}
