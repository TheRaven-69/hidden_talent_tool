import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Assessment as A } from "../../api/client";
import AIProcessing from "../../components/AIProcessing";

export default function Assessment() {
  const { applicationId } = useParams();
  const [asm, setAsm] = useState<A | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const generation = useRef<{ key: string; promise: Promise<A> }>();

  useEffect(() => {
    let active = true;
    setAsm(null); setError(""); setDone(false); setAnswers({});
    const key = `${applicationId}:${retry}`;
    // React StrictMode replays effects; reuse the pending creation request.
    if (generation.current?.key !== key) {
      generation.current = { key, promise: api.createAssessment(applicationId!) };
    }
    generation.current.promise.then(value => { if (active) setAsm(value); })
      .catch(() => { if (active) setError("We could not prepare the assessment. Check your connection and assessment eligibility before trying again."); });
    return () => { active = false; };
  }, [applicationId, retry]);

  const submit = async () => {
    if (!asm || submitting) return;
    setSubmitting(true); setError("");
    try {
      await api.submitAssessment(asm.id, answers);
      setDone(true);
    } catch { setError("We could not confirm that your answers were saved. Your answers are still here. Check your connection before retrying."); }
    finally { setSubmitting(false); }
  };

  if (!asm) return error ? <div role="alert"><h2>Assessment unavailable</h2><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>Try again</button></div> : <AIProcessing key={`${applicationId}:${retry}`} operation="assessment" />;
  if (done) return <div role="status"><h2>Assessment submitted</h2><p>Your answers and results have been saved for the employer to review.</p></div>;

  return (
    <div>
      <h2>Assessment</h2>
      {submitting && <AIProcessing operation="grading" />}
      {error && <p role="alert">{error}</p>}
      {asm.questions.map((q) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <p><strong>{q.text}</strong></p>
          {q.format === "multiple_choice" ? (
            q.options.map((o, i) => {
              const key = String.fromCharCode(65 + i);
              return (
                <label key={key} style={{ display: "block" }}>
                  <input type="radio" disabled={submitting} name={q.id} checked={answers[q.id] === key}
                    onChange={() => setAnswers({ ...answers, [q.id]: key })} /> {o}
                </label>
              );
            })
          ) : (
            <textarea rows={5} disabled={submitting} value={answers[q.id] || ""} aria-label={q.text} style={{ width: "100%" }}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
          )}
        </div>
      ))}
      <button disabled={submitting} onClick={submit}>{submitting ? "Reviewing answers…" : "Submit answers"}</button>
    </div>
  );
}
