import { useEffect, useState } from "react";
import "./ai-processing.css";

const operations = {
  application: {
    title: "Reviewing your experience",
    description: "AI identifies skills in your profile and compares them with this role's requirements.",
    outcome: "Once saved, your application confirmation and next steps will appear here.",
  },
  skills: {
    title: "Turning the description into skills",
    description: "AI identifies requirements and maps them to the skills catalog.",
    outcome: "You will be able to review, remove and prioritise the suggested skills.",
  },
  assessment: {
    title: "Preparing your assessment",
    description: "AI builds questions around this role, your experience and skills to explore.",
    outcome: "Your questions will appear when the assessment is ready.",
  },
  grading: {
    title: "Reviewing your answers",
    description: "Your responses are being scored, with AI reviewing written answers against the assessment criteria.",
    outcome: "We will confirm when your results have been saved for employer review.",
  },
};

export default function AIProcessing({ operation, compact = false }: {
  operation: keyof typeof operations;
  compact?: boolean;
}) {
  const [longWait, setLongWait] = useState(false);
  useEffect(() => {
    setLongWait(false);
    const timer = window.setTimeout(() => setLongWait(true), 60000);
    return () => window.clearTimeout(timer);
  }, [operation]);
  const content = operations[operation];
  return <div className={`ai-processing${compact ? " ai-processing-compact" : ""}`}>
    <div className="ai-processing-top"><span className="ai-processing-label"><span className="ai-processing-orbit" aria-hidden="true" />AI processing</span></div>
    <div role="status" aria-atomic="true">
      <h2>{content.title}</h2><p>{content.description}</p>
    </div>
    <div className="ai-processing-track" aria-hidden="true"><span /></div>
    <p className="ai-processing-outcome">{content.outcome}</p>
    <p className="ai-processing-wait" role="status">{longWait
      ? "Still waiting for the result. Analysis can take several minutes. Keep this page open; there is no need to submit again."
      : "This can take a few minutes, especially on the first analysis. Please keep this page open."}</p>
  </div>;
}
