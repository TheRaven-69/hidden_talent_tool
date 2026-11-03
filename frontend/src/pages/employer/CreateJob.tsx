import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, JobSkill, Weight } from "../../api/client";
import "./create-job.css";

export default function CreateJob() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [adText, setAdText] = useState("");
  const [assessmentBrief, setAssessmentBrief] = useState("");
  const [analysedText, setAnalysedText] = useState<string | null>(null);
  const [skills, setSkills] = useState<JobSkill[]>([]);
  const [gate, setGate] = useState(0.5);
  const [pass, setPass] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const stale = analysedText !== null && analysedText !== adText;
  const must = skills.filter(s => s.weight === "must").length;
  const ready = !!title.trim() && !!adText.trim() && skills.length > 0 && !stale && reviewed;
  const locked = busy || publishing;
  const suggest = async () => {
    setBusy(true); setError(""); setReviewed(false);
    try {
      const response = await api.suggestSkills(adText);
      setSkills(response.skills); setAnalysedText(adText);
    } catch { setError("We could not analyse the description. Your text is saved on this page. Please try again."); }
    finally { setBusy(false); }
  };
  const changeWeight = (id: string, weight: Weight) => {
    setSkills(skills.map(s => s.concept_id === id ? { ...s, weight } : s)); setReviewed(false);
  };
  const publish = async () => {
    if (!ready || locked) return;
    setPublishing(true); setError("");
    try {
      const job = await api.createJob({ id: "", title: title.trim(), location: location.trim(), ad_text: adText.trim(), skills, gate, pass_threshold: pass, assessment_brief: assessmentBrief.trim() });
      nav(`/employer/jobs/${job.id}/candidates`);
    } catch { setError("Publishing did not complete successfully. Your draft is still here. Check your connection before retrying."); }
    finally { setPublishing(false); }
  };
  return <div className="create-job-page">
    <header className="create-heading"><p className="form-kicker">Employer workspace / New vacancy</p><h1>Define the role.<br />Discover the potential.</h1><p>Turn your job description into clear skill requirements, then decide how candidates enter assessment.</p></header>
    <div className="create-layout">
      <div className="create-sections">
        <section className="form-section" aria-labelledby="role-heading">
          <div className="section-title"><span className="section-number">01</span><div><h2 id="role-heading">Describe the opportunity</h2><p>Give candidates a clear picture of the work and the experience it needs.</p></div></div>
          <div className="role-fields"><div><label htmlFor="job-title">Job title <span>Required</span></label><input id="job-title" value={title} disabled={locked} onChange={e => setTitle(e.target.value)} placeholder="e.g. Junior Python developer" maxLength={200} /></div><div><label htmlFor="job-location">Location <span>Optional</span></label><input id="job-location" value={location} disabled={locked} onChange={e => setLocation(e.target.value)} placeholder="e.g. Stockholm · Hybrid" maxLength={200} /></div></div>
          <label htmlFor="job-description">Job description <span>Required</span></label>
          <p className="field-help" id="description-help">Include responsibilities, tools and required qualifications. Keep essential requirements distinct from experience that would be a bonus.</p>
          <textarea id="job-description" rows={10} value={adText} disabled={locked} aria-describedby="description-help" onChange={e => { setAdText(e.target.value); setReviewed(false); }} placeholder="What will this person do?
Which skills will they use?
What can they learn on the job?" />
          <div className="analysis-action"><span className="field-help">{adText.length.toLocaleString()} characters · Original language preserved</span><button className="create-primary" type="button" disabled={locked || !adText.trim()} onClick={suggest}>{busy ? "Identifying skills…" : analysedText === null ? "Extract skills from description →" : "Analyse description again →"}</button></div>
          {busy && <p className="form-notice" role="status">Analysing the description and finding matching taxonomy skills. This may take a few minutes.</p>}
        </section>
        <section className="form-section" aria-labelledby="skills-heading">
          <div className="section-title"><span className="section-number">02</span><div><h2 id="skills-heading">Decide what matters</h2><p>Review the suggestions. Keep only skills that genuinely belong to this role.</p></div></div>
          {stale && <p className="form-notice" role="status">The description has changed. Analyse it again before publishing so the skills reflect your latest requirements.</p>}
          {analysedText === null ? <div className="skills-placeholder"><h3>Your requirements will appear here</h3><p>Add the job description above and extract its skills. You can then adjust importance or remove irrelevant suggestions.</p></div> : skills.length === 0 ? <div className="skills-placeholder"><h3>No skills selected</h3><p>Add more specific responsibilities and tools to the description, or analyse it again to restore suggestions.</p></div> : <>
            <div className="weight-explanation"><p><strong>Must-have</strong><span>Counts twice as much in skill coverage.</span></p><p><strong>Nice-to-have</strong><span>Adds value without the same weight.</span></p></div>
            <div className="skills-table"><div className="skills-table-heading"><span>Suggested skill · {skills.length}</span><span>Importance</span><span /></div>{skills.map(s => <div className="skill-edit-row" key={s.concept_id}><div className="skill-name">{s.label}<span>Taxonomy suggestion</span></div><select aria-label={`Importance of ${s.label}`} value={s.weight} disabled={locked || stale} onChange={e => changeWeight(s.concept_id, e.target.value as Weight)}><option value="must">Must-have</option><option value="nice">Nice-to-have</option></select><button className="remove-skill" type="button" aria-label={`Remove ${s.label}`} disabled={locked || stale} onClick={() => { setSkills(skills.filter(item => item.concept_id !== s.concept_id)); setReviewed(false); }}>Remove</button></div>)}</div>
            <p className="field-help">AI mappings can be incorrect. “Must-have” increases scoring weight; it does not independently block entry to assessment.</p>
            <label className="review-confirmation"><input type="checkbox" checked={reviewed} disabled={locked || stale} onChange={e => setReviewed(e.target.checked)} /><span>I have reviewed these skills and their importance.</span></label>
          </>}
        </section>
        <section className="form-section" aria-labelledby="assessment-heading">
          <div className="section-title"><span className="section-number">03</span><div><h2 id="assessment-heading">Shape the assessment</h2><p>Define what a good candidate should demonstrate, separately from the public job description.</p></div></div>
          <div className="assessment-brief-block">
            <p className="internal-label">Internal · Assessment guidance</p>
            <label htmlFor="assessment-brief">What should the assessment verify? <span>Optional</span></label>
            <p className="field-help" id="assessment-brief-help">Describe the practical abilities you want to check and what a good answer should demonstrate. This guides questions and grading criteria; it is not part of the candidate-facing job description.</p>
            <textarea id="assessment-brief" rows={7} value={assessmentBrief} maxLength={6000} disabled={locked} aria-describedby="assessment-brief-help" onChange={e => setAssessmentBrief(e.target.value)} placeholder="For a junior Python role: check whether the candidate can explain a small API, validate inputs and propose a useful test. A good answer should describe their reasoning and recognise errors. Production operations experience is not expected." />
            <p className="field-help">{assessmentBrief.length.toLocaleString()} / 6,000 characters · If left empty, questions use the selected job skills.</p>
          </div>
          <div className="threshold-control"><div><label htmlFor="assessment-gate">CV match required for assessment</label><output htmlFor="assessment-gate">{Math.round(gate * 100)}%</output></div><p className="field-help">Candidates at or above this score can start the tailored assessment. Lower-scoring applications remain available for human review.</p><input id="assessment-gate" type="range" min={0} max={1} step={0.05} value={gate} disabled={locked} onChange={e => setGate(+e.target.value)} /><div className="range-labels"><span>Broader access · 0%</span><span>Closer match · 100%</span></div></div>
          <div className="threshold-control"><div><label htmlFor="assessment-target">Assessment target</label><output htmlFor="assessment-target">{Math.round(pass * 100)}%</output></div><p className="field-help">Save your intended benchmark for assessment results. This target is not yet applied to results or decisions in the current prototype.</p><input id="assessment-target" type="range" min={0} max={1} step={0.05} value={pass} disabled={locked} onChange={e => setPass(+e.target.value)} /><div className="range-labels"><span>0%</span><span>100%</span></div></div>
          <p className="human-note">Scores support your review. Final hiring decisions stay with you.</p>
        </section>
      </div>
      <aside className="publish-panel" aria-label="Vacancy summary">
        <p className="form-kicker">Vacancy summary</p><h2>{title.trim() || "Your next opportunity"}</h2><p className="summary-location">{location.trim() || "Location not specified"}</p>
        <dl className="vacancy-stats"><div><dt>Must-have skills</dt><dd>{must}</dd></div><div><dt>Nice-to-have skills</dt><dd>{skills.length - must}</dd></div><div><dt>Assessment guidance</dt><dd>{assessmentBrief.trim() ? "Added" : "Use job skills"}</dd></div><div><dt>Assessment entry</dt><dd>{Math.round(gate * 100)}%</dd></div><div><dt>Assessment target</dt><dd>{Math.round(pass * 100)}%</dd></div></dl>
        <h3>Before you publish</h3><ul className="readiness-list">{[{done: !!title.trim() && !!adText.trim(), text: "Role and description added"}, {done: skills.length > 0 && !stale, text: "Skills extracted from latest text"}, {done: reviewed && !stale, text: "Skills reviewed by you"}].map(item => <li key={item.text}><span className={item.done ? "check-done" : "check-pending"} aria-label={item.done ? "Complete:" : "Pending:"}>{item.done ? "✓" : "○"}</span>{item.text}</li>)}</ul>
        <button type="button" className="create-secondary" onClick={() => setPreview(!preview)} aria-expanded={preview}>{preview ? "Hide description preview" : "Preview description"}</button>
        {preview && <div className="description-preview"><h3>{title || "Untitled vacancy"}</h3><p>{adText || "Your job description will appear here."}</p></div>}
        <button className="create-primary publish-button" type="button" disabled={!ready || locked} onClick={publish}>{publishing ? "Publishing vacancy…" : "Publish vacancy →"}</button>
        <p className="field-help">Publishing makes this vacancy available in the app. You’ll then see its candidate dashboard.</p>
        {error && <p className="publish-error" role="alert">{error}</p>}
        <p className="draft-note">Draft stays on this page only. Leaving or refreshing will discard unsaved edits.</p>
      </aside>
    </div>
  </div>;
}
