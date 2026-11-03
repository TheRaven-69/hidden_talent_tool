import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Application } from "../../api/client";
import ScoreDisplay from "../../components/ScoreDisplay";

export default function Apply() {
  const { jobId } = useParams();
  const [candidateId, setCandidateId] = useState("");
  const [cvText, setCvText] = useState("");
  const [result, setResult] = useState<Application | null>(null);

  const submit = async () =>
    setResult(await api.apply({
      job_id: jobId!,
      candidate_id: candidateId || undefined,
      cv_text: cvText || undefined,
    }));

  return (
    <div>
      <h2>Apply</h2>
      <input placeholder="Mock profile id (e.g. cand-042)" value={candidateId} onChange={(e) => setCandidateId(e.target.value)} />
      <p>or paste your CV text:</p>
      <textarea rows={10} style={{ width: "100%" }} value={cvText} onChange={(e) => setCvText(e.target.value)} />
      <button onClick={submit}>Submit application</button>
      {result && (
        <div>
          <ScoreDisplay label="Match" value={result.match_score} />
          {result.status === "assessment_invited"
            ? <Link to={`/assessment/${result.id}`}>Start assessment</Link>
            : <p>Thank you! The employer will review your application.</p>}
        </div>
      )}
    </div>
  );
}
