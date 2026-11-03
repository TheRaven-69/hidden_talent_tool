import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Assessment as A } from "../../api/client";

export default function Assessment() {
  const { applicationId } = useParams();
  const [asm, setAsm] = useState<A | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  useEffect(() => { api.createAssessment(applicationId!).then(setAsm); }, [applicationId]);

  const submit = async () => {
    await api.submitAssessment(asm!.id, answers);
    setDone(true);
  };

  if (!asm) return <p>Preparing your assessment…</p>;
  if (done) return <p>Thanks! Your answers have been submitted.</p>;

  return (
    <div>
      <h2>Assessment</h2>
      {asm.questions.map((q) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <p><strong>{q.text}</strong></p>
          {q.format === "multiple_choice" ? (
            q.options.map((o, i) => {
              const key = String.fromCharCode(65 + i);
              return (
                <label key={key} style={{ display: "block" }}>
                  <input type="radio" name={q.id} checked={answers[q.id] === key}
                    onChange={() => setAnswers({ ...answers, [q.id]: key })} /> {o}
                </label>
              );
            })
          ) : (
            <textarea rows={5} style={{ width: "100%" }}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
          )}
        </div>
      ))}
      <button onClick={submit}>Submit</button>
    </div>
  );
}
