import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, JobSkill, Weight } from "../../api/client";
import AIProcessing from "../../components/AIProcessing";
import ScoreThreshold from "../../components/ScoreThreshold";
import "./create-job.css";

export default function CreateJob() {
  const nav = useNavigate();
  const skillsHeading = useRef<HTMLHeadingElement>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [adText, setAdText] = useState("");
  const [assessmentBrief, setAssessmentBrief] = useState("");
  const [analysis, setAnalysis] = useState<{ text: string } | null>(null);
  const [skills, setSkills] = useState<JobSkill[]>([]);
  const [gate, setGate] = useState(0.5);
  const [pass, setPass] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [publishError, setPublishError] = useState("");

  const stale = analysis !== null && analysis.text !== adText;
  const locked = busy || publishing;
  const gatePercent = Math.round(gate * 100);

  let publishBlocker = "";
  if (!title.trim() || !adText.trim()) {
    publishBlocker = "Add a title and description.";
  } else if (stale) {
    publishBlocker = "Analyse the updated description.";
  } else if (!skills.length) {
    publishBlocker = "Identify skills from the description.";
  } else if (!reviewed) {
    publishBlocker = "Confirm the skills before publishing.";
  }

  useEffect(() => {
    if (analysis) skillsHeading.current?.focus();
  }, [analysis]);

  const suggest = async () => {
    setBusy(true);
    setAnalysisError("");
    setReviewed(false);
    try {
      const response = await api.suggestSkills(adText);
      setSkills(response.skills);
      setAnalysis({ text: adText });
    } catch {
      setAnalysisError("Could not analyse the description. Your text is still here. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const changeWeight = (id: string, weight: Weight) => {
    setSkills(skills.map(skill => skill.concept_id === id ? { ...skill, weight } : skill));
    setReviewed(false);
  };

  const publish = async () => {
    if (publishBlocker || locked) return;
    setPublishing(true);
    setPublishError("");
    try {
      const job = await api.createJob({
        id: "",
        title: title.trim(),
        location: location.trim(),
        ad_text: adText.trim(),
        skills,
        gate,
        pass_threshold: pass,
        assessment_brief: assessmentBrief.trim(),
      });
      nav(`/employer/jobs/${job.id}/candidates`);
    } catch {
      setPublishError("Could not publish the job. Your draft is still here. Check your connection and try again.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="create-job-page">
      <header className="create-heading">
        <h1>Post a job</h1>
        <p>Add the details, review the suggested skills, then publish.</p>
      </header>

      <section className="form-section" aria-labelledby="role-heading">
        <div className="section-title">
          <span className="section-number" aria-hidden="true">1</span>
          <h2 id="role-heading">Job details</h2>
        </div>
        <div className="role-fields">
          <div>
            <label htmlFor="job-title">Job title</label>
            <input id="job-title" aria-required="true" value={title} disabled={locked} onChange={e => setTitle(e.target.value)} placeholder="e.g. Junior Python developer" maxLength={200} />
          </div>
          <div>
            <label htmlFor="job-location">Location <span className="optional-label">Optional</span></label>
            <input id="job-location" value={location} disabled={locked} onChange={e => setLocation(e.target.value)} placeholder="e.g. Stockholm · Hybrid" maxLength={200} />
          </div>
        </div>
        <label htmlFor="job-description">Job description</label>
        <p className="create-help" id="description-help">Include responsibilities, tools and essential qualifications.</p>
        <textarea
          id="job-description"
          rows={6}
          aria-required="true"
          aria-describedby="description-help"
          value={adText}
          disabled={locked}
          onChange={e => { setAdText(e.target.value); setReviewed(false); }}
        />
        <div className="analysis-action">
          <button className="create-primary" type="button" disabled={locked || !adText.trim()} onClick={suggest}>
            {busy ? "Identifying skills…" : analysis ? "Identify skills again" : "Identify skills"}
          </button>
        </div>
        {busy && <AIProcessing operation="skills" compact />}
        {analysisError && <p className="create-error" role="alert">{analysisError}</p>}
      </section>

      {analysis && (
        <section className="form-section" aria-labelledby="skills-heading">
          <div className="section-title">
            <span className="section-number" aria-hidden="true">2</span>
            <h2 id="skills-heading" ref={skillsHeading} tabIndex={-1}>Review skills</h2>
            <span className="skill-count">{skills.length} {skills.length === 1 ? "skill" : "skills"}</span>
          </div>
          {stale && <p className="create-notice" role="status">The description changed. Identify skills again to update this list.</p>}
          {skills.length === 0 ? (
            <p className="create-help">No skills to review. Add more specific tasks or tools to the description and try again.</p>
          ) : (
            <>
              <p className="create-help">Check the AI suggestions. Must-have skills carry twice the weight in skill coverage. Assessment access uses the overall CV match.</p>
              <ul className="skills-list">
                {skills.map(skill => (
                  <li className="skill-edit-row" key={skill.concept_id}>
                    <span className="skill-name">{skill.label}</span>
                    <select aria-label={`Importance of ${skill.label}`} value={skill.weight} disabled={locked || stale} onChange={e => changeWeight(skill.concept_id, e.target.value as Weight)}>
                      <option value="must">Must-have</option>
                      <option value="nice">Nice-to-have</option>
                    </select>
                    <button className="remove-skill" type="button" aria-label={`Remove ${skill.label}`} disabled={locked || stale} onClick={() => {
                      setSkills(skills.filter(item => item.concept_id !== skill.concept_id));
                      setReviewed(false);
                    }}>Remove</button>
                  </li>
                ))}
              </ul>
              <label className="review-confirmation">
                <input type="checkbox" checked={reviewed} disabled={locked || stale} onChange={e => setReviewed(e.target.checked)} />
                I’ve reviewed the skills and their importance.
              </label>
            </>
          )}
        </section>
      )}

      <details className="create-disclosure">
        <summary><span>Assessment settings</span><span className="disclosure-note">{gatePercent}% CV match</span></summary>
        <div className="disclosure-content">
          <ScoreThreshold id="assessment-gate" kind="entry" value={gate} disabled={locked} onChange={setGate} />
          <ScoreThreshold id="assessment-target" kind="target" value={pass} disabled={locked} onChange={setPass} />
          <label htmlFor="assessment-brief">Internal assessment instructions <span className="optional-label">Optional</span></label>
          <p className="create-help" id="assessment-brief-help">Describe what a strong answer should demonstrate. This guides the questions and scoring. By default, questions use the selected skills.</p>
          <textarea id="assessment-brief" rows={4} value={assessmentBrief} maxLength={6000} disabled={locked} aria-describedby="assessment-brief-help" onChange={e => setAssessmentBrief(e.target.value)} />
          <p className="create-help">{assessmentBrief.length.toLocaleString()} / 6,000 characters</p>
        </div>
      </details>

      <details className="create-disclosure">
        <summary>Preview job</summary>
        <div className="disclosure-content description-preview">
          <h2>{title.trim() || "Untitled job"}</h2>
          {location.trim() && <p className="create-help">{location.trim()}</p>}
          <p className="description-preview-text">{adText.trim() || "Your job description will appear here."}</p>
        </div>
      </details>

      <footer className="publish-panel">
        <div>
          <p className="publish-status" role="status">
            {publishing ? "Publishing…" : publishBlocker || "Ready to publish."}
          </p>
          <p className="create-help">Keep this page open to preserve your draft.</p>
        </div>
        <button className="create-primary" type="button" disabled={Boolean(publishBlocker) || locked} onClick={publish}>Publish job</button>
        {publishError && <p className="create-error" role="alert">{publishError}</p>}
      </footer>
    </div>
  );
}
