import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApplicationReview } from "../../api/client";
import SkillBreakdown from "../../components/SkillBreakdown";
import "./applications.css";
import "./application-details.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;
const questionTypes: Record<string, string> = { hard_skill: "Technical skills", soft_skill: "Interpersonal skills", cv_based: "Experience", gap_probe: "Skills to explore" };

export default function ApplicationDetails() {
  const { applicationId } = useParams();
  const [row, setRow] = useState<ApplicationReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setRow(null);
    api.applicationReview(applicationId!).then(value => { if (active) setRow(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error && reason.message.startsWith("404") ? "This application could not be found." : "Could not load this application. Check your connection and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applicationId, refresh]);
  useEffect(() => { if (row) heading.current?.focus(); }, [row]);
  const application = row?.application;
  const assessment = row?.assessment;
  return <div className="application-review-page">
    <Link to="/employer/applications">← All applications</Link>
    {loading ? <p role="status">Loading application…</p> : error ? <div className="applications-message" role="alert"><p>{error}</p><button onClick={() => setRefresh(n => n + 1)}>Try again</button></div> : row && application && <>
      <header className="review-header"><div><p className="applications-eyebrow">APPLICATION REVIEW</p><h1 ref={heading} tabIndex={-1}>{application.full_name || application.candidate_id}</h1><p>{row.job.title}{!row.job.available && " · Job unavailable"}</p><p className="applications-note">{application.id} · Candidate {application.candidate_id}{application.submitted_at && ` · Applied ${new Date(application.submitted_at).toLocaleString()}`}</p></div><button className="applications-button" onClick={() => setRefresh(n => n + 1)}>Refresh</button></header>
      <nav className="review-navigation" aria-label="Application sections"><a href="#review-overview">Overview</a><a href="#review-cv">CV &amp; skills</a><a href="#review-assessment">Assessment answers</a><Link to={`/employer/jobs/${encodeURIComponent(row.job.id)}/candidates`}>Other applicants for this job →</Link></nav>
      <section className="review-panel" id="review-overview"><h2>At a glance</h2><div className="review-metrics"><div><span>CV match</span><strong>{percent(application.match_score)}</strong><p>Based on the profile and job requirements.</p></div><div><span>Assessment score</span><strong>{assessment?.total_score != null ? percent(assessment.total_score) : "Not scored"}</strong><p>{row.assessment_state === "completed" ? "Completed assessment, scored automatically." : row.assessment_state === "in_progress" ? "Assessment created; no submitted result yet." : "No assessment submitted."}</p></div><div><span>Required skills to verify</span><strong>{row.cv_summary.missing_required.length}</strong><p>Not evidenced in the CV; this does not prove a lack of ability.</p></div></div><p className="applications-note">Review the evidence below. Scores support your judgement; they do not make a hiring decision.</p></section>
      <section className="review-panel" id="review-cv"><p className="applications-eyebrow">01 / EXPERIENCE</p><h2>CV &amp; skill evidence</h2><div className="review-evidence-grid"><div><h3>Candidate background</h3><p className="applications-note">{row.cv_source === "submission" ? "CV saved with this application." : row.cv_source === "current_profile" ? "Showing the current profile. A CV snapshot was not saved with this older application." : "The candidate profile is unavailable."}</p><p className="review-cv-text">{row.cv_text || "No CV text available."}</p></div><div><h3>Match to job requirements</h3>{application.skill_breakdown.length ? <SkillBreakdown items={application.skill_breakdown} /> : <p>No skill evidence was recorded.</p>}</div></div></section>
      <section className="review-panel" id="review-assessment"><p className="applications-eyebrow">02 / ASSESSMENT</p><h2>Questions, answers &amp; explanations</h2>
        {row.assessment_state !== "completed" ? <div className="applications-empty"><h3>{row.assessment_state === "in_progress" ? "Waiting for the candidate’s answers" : "No assessment results yet"}</h3><p>{application.status === "below_gate" ? "The CV match is below the minimum score for assessment. You can still review the candidate’s experience above." : "Answers and score explanations will appear after the candidate submits the assessment."}</p></div> : <>
          <p className="applications-note">{assessment?.questions.length || 0} questions · {row.attempt_count > 1 ? `Latest recorded completed assessment from ${row.attempt_count} attempts.` : "Completed assessment."}</p>
          {!assessment?.questions.length && <p>No question details were saved for this assessment.</p>}
          {assessment?.questions.map((question, index) => {
            const letterIndex = question.answer?.trim().toUpperCase().match(/^[A-Z]$/) ? question.answer.trim().toUpperCase().charCodeAt(0) - 65 : -1;
            const selectedOption = question.format === "multiple_choice" ? question.options[letterIndex] : undefined;
            return <article className="review-question" key={question.id}><header><span>Question {index + 1} · {questionTypes[question.type] || "Skills"}</span><span className="review-question-score">{question.score == null ? "Not scored" : `${percent(question.score)} score`}</span></header><h3>{question.text}</h3>
              {!!question.options.length && <ol type="A" className="review-options">{question.options.map((option, optionIndex) => <li className={optionIndex === letterIndex ? "is-selected" : ""} key={optionIndex}>{option}{optionIndex === letterIndex && <strong> · Candidate’s choice</strong>}</li>)}</ol>}
              <div className="review-answer-grid"><section><h4>Candidate’s answer</h4><p>{selectedOption ? `${question.answer} — ${selectedOption}` : question.answer?.trim() || "No answer submitted."}</p></section><section><h4>Why this score?</h4><p>{question.reasoning || (question.format === "multiple_choice" ? "This answer was scored against the saved answer key. No written explanation was saved." : "No score explanation was saved for this answer.")}</p></section></div>
            </article>;
          })}
        </>}
      </section>
    </>}
  </div>;
}
