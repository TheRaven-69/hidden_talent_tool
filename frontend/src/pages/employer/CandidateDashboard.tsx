import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, RankedCandidate } from "../../api/client";
import ScoreDisplay from "../../components/ScoreDisplay";
import SkillBreakdown from "../../components/SkillBreakdown";

export default function CandidateDashboard() {
  const { jobId } = useParams();
  const [rows, setRows] = useState<RankedCandidate[]>([]);

  useEffect(() => { api.rankedCandidates(jobId!).then(setRows); }, [jobId]);

  return (
    <div>
      <h2>Candidates</h2>
      <p><em>Scores support your decision; the decision is yours.</em></p>
      {rows.map(({ application: a, assessment }) => (
        <details key={a.id} style={{ marginBottom: 12 }}>
          <summary>
            {a.candidate_id}{" "}
            <ScoreDisplay label="Match" value={a.match_score} />
            <ScoreDisplay label="Assessment" value={assessment?.total_score} />
          </summary>
          <SkillBreakdown items={a.skill_breakdown} />
        </details>
      ))}
    </div>
  );
}
