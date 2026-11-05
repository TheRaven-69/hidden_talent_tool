import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApplicationReview } from "../../api/client";
import "./application-details.css";
import "./applications.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;
function stage(row: ApplicationReview) {
  if (row.assessment_state === "completed") return "Assessment completed";
  if (row.assessment_state === "in_progress") return "Assessment in progress";
  if (row.application.status === "below_gate") return "Below assessment minimum";
  if (row.application.status === "assessment_invited") return "Awaiting assessment";
  return "Applied";
}

export default function Applications() {
  const { jobId } = useParams();
  const [rows, setRows] = useState<ApplicationReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [job, setJob] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setRows([]);
    api.applicationReviews(jobId).then(result => { if (active) setRows(result); })
      .catch(() => { if (active) setError("Applications could not be loaded. Check the backend connection and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, refresh]);
  useEffect(() => { setJob(""); setStatus(""); setQuery(""); }, [jobId]);

  const jobs = [...new Map(rows.map(row => [row.job.id, row.job.title])).entries()];
  const filtered = rows.filter(row => (!job || row.job.id === job) && (!status || stage(row) === status)
    && `${row.application.candidate_id} ${row.application.id} ${row.job.title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const completed = rows.filter(row => row.assessment_state === "completed").length;

  return <section className="applications-page">
    <div className="applications-heading">
      <div><p className="applications-eyebrow">EMPLOYER WORKSPACE</p><h1>Applications</h1>
        <p>See the experience behind each CV and the evidence from each assessment.</p>
        {jobId && <p>{rows[0]?.job.title || "Applications for this job"} · <Link to="/employer/applications">View all applications</Link></p>}
      </div>
      <button className="applications-button" disabled={loading} onClick={() => setRefresh(n => n + 1)}>Refresh</button>
    </div>
    {loading ? <p role="status">Loading applications…</p> : error ? <div role="alert" className="applications-message">{error} <button onClick={() => setRefresh(n => n + 1)}>Try again</button></div> : <>
      <div className="applications-stats">
        <div><strong>{rows.length}</strong><span>Applications received</span></div>
        <div><strong>{completed}</strong><span>Assessments completed</span></div>
        <div><strong>{rows.filter(row => ["Awaiting assessment", "Assessment in progress"].includes(stage(row))).length}</strong><span>Awaiting completion</span></div>
      </div>
      <p className="applications-note">CV evidence and assessment results are shown separately. Scores support your review; hiring decisions remain yours.</p>
      {rows.length > 0 ? <>
        <div className="applications-filters">
          <label>Search applications<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Candidate ID, application ID or job title" type="search" /></label>
          {!jobId && <label>Job<select value={job} onChange={e => setJob(e.target.value)}><option value="">All jobs</option>{jobs.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>}
          <label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{["Applied", "Awaiting assessment", "Assessment in progress", "Assessment completed", "Below assessment minimum"].map(s => <option key={s}>{s}</option>)}</select></label>
        </div>
        <p aria-live="polite" className="applications-note">Showing {filtered.length} of {rows.length} applications</p>
        {filtered.length === 0 && <div className="applications-message">No applications match these filters. <button onClick={() => { setQuery(""); setJob(""); setStatus(""); }}>Clear filters</button></div>}
        <div className="applications-list">{filtered.map(row => <ReviewCard key={row.application.id} row={row} />)}</div>
      </> : <div className="applications-empty"><h2>No applications yet</h2><p>Once a candidate applies, their CV evidence will appear here. Assessment results are added after submission.</p><Link to="/">Browse jobs</Link></div>}
    </>}
  </section>;
}

function ReviewCard({ row }: { row: ApplicationReview }) {
  const { application, assessment, cv_summary: cv } = row;
  const scored = assessment?.questions.filter(q => q.score != null) || [];
  return <article className="application-card">
    <header className="application-card-heading"><div><h2>{application.candidate_id}</h2><p>{row.job.title}{!row.job.available && " · Job unavailable"}</p>
      <small>{application.id}{application.submitted_at && ` · Applied ${new Date(application.submitted_at).toLocaleString()}`}</small></div>
      <span className={`application-stage ${row.assessment_state === "completed" ? "is-complete" : ""}`}>{stage(row)}</span>
    </header>
    <div className="application-summaries">
      <section><div className="application-section-heading"><h3>CV summary</h3><strong>{percent(application.match_score)} match</strong></div>
        <p>{cv.explicit.length} job skills supported by the CV; {cv.inferred.length} suggested by the experience described.</p>
        <SummaryLine label="CV evidence" items={cv.explicit} empty="No directly supported skill matches found." />
        <SummaryLine label="Potential skills to verify" items={cv.inferred} empty="No additional potential skill matches found." />
        <SummaryLine label="Required skills to verify" items={cv.missing_required} empty="No required-skill gaps recorded." />
        <p className="applications-note">Missing evidence does not prove a lack of ability.</p>
      </section>
      <section><div className="application-section-heading"><h3>Assessment summary</h3><strong>{assessment?.total_score != null ? percent(assessment.total_score) : "Not scored"}</strong></div>
        {row.assessment_state === "completed" ? <>
          <p>{scored.length} of {assessment?.questions.length} questions scored. Open the application to review answers and score explanations.</p>
          {Object.entries(assessment?.per_skill || {}).map(([id, score]) => <div className="application-skill-score" key={id}><span>{application.skill_breakdown.find(s => s.concept_id === id)?.label || id}</span><strong>{percent(score)}</strong></div>)}
          {row.attempt_count > 1 && <p className="applications-note">Showing the latest recorded completed assessment from {row.attempt_count} attempts.</p>}
        </> : <p>{row.assessment_state === "in_progress" ? "The assessment has been created. No submitted result is available yet." : application.status === "below_gate" ? "The CV match is below the minimum score needed to start the assessment. The application remains available for review." : "No assessment result yet. The candidate can complete it after applying."}</p>}
      </section>
    </div>
    <footer className="application-view-link"><Link to={`/employer/applications/${encodeURIComponent(application.id)}`}>View application →</Link></footer>
  </article>;
}

function SummaryLine({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return <p><strong>{label}: </strong>{items.length ? items.join(", ") : empty}</p>;
}
