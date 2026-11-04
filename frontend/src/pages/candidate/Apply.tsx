import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, Application, Job } from "../../api/client";
import SkillBreakdown from "../../components/SkillBreakdown";
import "./apply.css";

type Profile = { id: string; background_text?: string };
export default function Apply() {
  const { jobId } = useParams();
  const [params] = useSearchParams();
  const [candidateId, setCandidateId] = useState(params.get("candidate_id") || "");
  const [cvText, setCvText] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesError, setProfilesError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    setJob(null); setLoading(true); setLoadError(""); setResult(null); setError("");
    api.jobDetails(jobId!).then(value => { if (active) setJob(value); })
      .catch(() => { if (active) setLoadError("We could not load this vacancy. It may be unavailable, or there may be a connection problem."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, reload]);
  useEffect(() => {
    let active = true;
    api.candidates().then(values => { if (active) setProfiles(values); })
      .catch(() => { if (active) setProfilesError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (result) resultHeading.current?.focus(); }, [result]);
  const profile = profiles.find(p => p.id === candidateId);
  const locked = busy || !!result;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || result || !job) return;
    if (!candidateId && !cvText.trim()) { setError("Choose a fictional profile or add fictional CV text before submitting."); return; }
    setBusy(true); setError("");
    try {
      setResult(await api.apply({ job_id: job.id, candidate_id: candidateId || undefined, cv_text: candidateId ? undefined : cvText.trim() }));
    } catch { setError("We could not confirm submission. Your profile is still here. Check your connection before retrying."); }
    finally { setBusy(false); }
  };
  const expired = job?.application_deadline && Date.parse(job.application_deadline) < Date.now();
  return <div className="application-page">
    <Link className="application-back" to="/">← Back to all vacancies</Link>
    {loading && <div className="application-state" role="status"><h1>Loading the opportunity…</h1><p>Getting the description and requirements.</p></div>}
    {loadError && <div className="application-state" role="alert"><h1>Vacancy unavailable</h1><p>{loadError}</p><button className="apply-secondary" onClick={() => setReload(n => n + 1)}>Try again</button></div>}
    {job && <>
      <header className="application-heading"><p className="apply-kicker">Candidate workspace / Application</p><h1>{job.title}</h1><div className="role-metadata"><span>{job.location || "Location not specified"}</span>{job.sector && <span>{job.sector.replace(/-/g, " ")}</span>}<span>{job.source === "search" ? "Starter demo vacancy" : "Employer-created vacancy"}</span></div></header>
      {job.source === "search" && <p className="apply-snapshot">Frozen demo snapshot · {expired ? "The recorded application deadline has passed. This page is available for a demo application." : "The vacancy may no longer be open. This application is part of the demo."}</p>}
      <div className="application-layout">
        <div className="application-context">
          <section className="apply-section"><p className="apply-kicker">01 / The opportunity</p><h2>Understand the role</h2><p className="apply-muted">Original vacancy description</p><div className="application-description">{job.ad_text || "No description is available for this vacancy."}</div></section>
          <section className="apply-section"><p className="apply-kicker">02 / Requirements</p><h2>Skills the role calls for</h2><p className="apply-muted">Use the original description to check qualifications, licences and language requirements.</p>
            {job.skills.length > 0 ? <><ul className="application-requirements">{job.skills.map(s => <li key={s.concept_id}><span>{s.label}</span></li>)}</ul><p className="apply-small apply-muted">These skills were identified from the vacancy. Refer to the original description for the employer’s requirements.</p></> : <div className="requirements-pending"><h3>No structured skills available yet</h3><p>Review the requirements in the description above. Skills will be analysed when the application is processed.</p></div>}
          </section>
          <section className="apply-section"><p className="apply-kicker">03 / What comes next</p><h2>From experience to assessment</h2><ol className="application-next-steps"><li><span>1</span><div><h3>We compare your experience</h3><p>Your profile is matched to the vacancy’s skills. You’ll see the match score and the supporting evidence.</p></div></li><li><span>2</span><div><h3>You may be invited to an assessment</h3><p>After your profile is reviewed, a tailored assessment may become available. It checks relevant skills, experience and gaps. Your application remains available to the employer for review.</p></div></li><li><span>3</span><div><h3>The employer reviews your application</h3><p>The employer sees the CV match and, when completed, assessment results. A person makes the hiring decision.</p></div></li></ol></section>
        </div>
        <aside className="application-sidebar">
          {!result ? <form className="application-form" onSubmit={submit} aria-busy={busy}>
            <p className="apply-kicker">Your application</p><h2>Bring your experience</h2><p className="apply-muted">Use a fictional profile for this demo. The profile you choose will be submitted to this vacancy.</p>
            {params.get("candidate_id") && candidateId === params.get("candidate_id") && <p className="profile-carried">Your profile from recommendations is selected.</p>}
            <label htmlFor="application-profile">Candidate profile</label><select id="application-profile" value={candidateId} disabled={locked} onChange={e => { setCandidateId(e.target.value); setError(""); }}><option value="">Enter fictional CV text</option>{candidateId && !profile && <option value={candidateId}>Saved profile · {candidateId}</option>}{profiles.map(p => <option key={p.id} value={p.id}>{p.id} — {p.background_text?.slice(0, 60)}</option>)}</select>
            {profilesError && <p className="apply-small apply-muted">Demo profiles could not be loaded. You can enter fictional CV text instead, or use the saved profile already selected.</p>}
            {candidateId ? <div className="selected-profile"><p className="apply-kicker">Selected experience</p><p>{profile?.background_text || `Saved profile ${candidateId} will be used for matching. Its text is not available in this selector.`}</p></div> : <><label htmlFor="application-cv">Fictional CV or background</label><textarea id="application-cv" rows={9} disabled={locked} value={cvText} aria-describedby="cv-help" onChange={e => { setCvText(e.target.value); setError(""); }} placeholder="Describe tasks, projects, tools and practical experience…" /><p className="apply-small apply-muted" id="cv-help">Paste fictional text only. File upload is not available yet.</p></>}

            {error && <p className="apply-error" role="alert">{error}</p>}
            <button type="submit" className="apply-primary" disabled={locked}>{busy ? "Matching your application…" : "Submit application →"}</button>
            {busy ? <p className="apply-small" role="status">Identifying skills and comparing requirements. First-time analysis may take several minutes. Please keep this page open.</p> : <p className="apply-small apply-muted">Submission saves your application in the demo. Assessment starts only when you choose to begin.</p>}
          </form> : <section className="application-receipt" aria-labelledby="application-receipt-heading">
            <p className="apply-kicker">Application saved</p><h2 id="application-receipt-heading" tabIndex={-1} ref={resultHeading}>Your experience is on the table.</h2><p className="apply-muted">Your application to {job.title} has been submitted.</p><div className="receipt-score"><strong>{Math.round(result.match_score * 100)}<span>%</span></strong><span>CV match</span></div>
            {result.status === "assessment_invited" ? <><h3>You can start your assessment</h3><p>The next step checks your skills through questions tailored to this role and your experience.</p><Link className="apply-primary" to={`/assessment/${encodeURIComponent(result.id)}`}>Start assessment →</Link></> : <><h3>Application available for employer review</h3><p>There is no assessment invitation at this stage. Your application remains available to the employer, who makes the hiring decision.</p><Link className="apply-secondary" to="/recommendations">Explore other matches →</Link></>}
            <details className="receipt-evidence"><summary>See the skill match and evidence</summary><SkillBreakdown items={result.skill_breakdown} showWeights={false} /></details><p className="apply-small apply-muted">Application reference: {result.id}</p>
          </section>}
        </aside>
      </div>
    </>}
  </div>;
}
