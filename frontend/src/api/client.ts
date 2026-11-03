// Typed fetch helpers for the endpoints in README section 10.
export type Weight = "must" | "nice";
export type SkillStatus = "explicit" | "inferred" | "missing";

export interface JobSkill { concept_id: string; label: string; weight: Weight }
export interface Job {
  id: string; title: string; location: string; ad_text: string;
  skills: JobSkill[]; gate: number; pass_threshold: number;
}
export interface SkillBreakdownItem {
  concept_id: string; label: string; weight: Weight; status: SkillStatus; evidence?: string;
}
export interface Application {
  id: string; job_id: string; candidate_id: string; match_score: number;
  skill_breakdown: SkillBreakdownItem[]; status: string;
}
export interface Question {
  id: string; type: string; format: "multiple_choice" | "open"; text: string;
  options: string[]; answer?: string; score?: number; reasoning?: string;
}
export interface Assessment {
  id: string; application_id: string; questions: Question[];
  total_score?: number; per_skill: Record<string, number>;
}
export interface RankedCandidate { application: Application; assessment: Assessment | null }

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
const post = <T,>(path: string, body: unknown) =>
  http<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  suggestSkills: (ad_text: string) => post<{ skills: JobSkill[] }>("/jobs/suggest-skills", { ad_text }),
  createJob: (job: Job) => post<Job>("/jobs", job),
  listJobs: (q?: string) => http<Job[]>(`/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  apply: (body: { job_id: string; candidate_id?: string; cv_text?: string }) =>
    post<Application>("/applications", body),
  createAssessment: (applicationId: string) => post<Assessment>(`/assessments/${applicationId}`, {}),
  submitAssessment: (id: string, answers: Record<string, string>) =>
    post<Assessment>(`/assessments/${id}/submit`, { answers }),
  rankedCandidates: (jobId: string) => http<RankedCandidate[]>(`/jobs/${jobId}/candidates`),
};
