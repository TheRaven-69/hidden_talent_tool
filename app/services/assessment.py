"""Tailored assessment: question generation (README section 9) and grading."""
import uuid

from app.models.schemas import (
    Application,
    Assessment,
    Candidate,
    GeneratedQuestions,
    GradeResult,
    Job,
    Question,
)
from app import prompts
from app.services import llm
from app.services.normalize import strip_pii

# Target mix: 6-8 questions total
QUESTION_MIX = {"hard_skill": 3, "soft_skill": 1, "cv_based": 1, "gap_probe": 1}


def build_generation_prompt(job: Job, candidate: Candidate, breakdown: list[dict]) -> str:
    must_missing = [b["label"] + f" ({b['concept_id']})" for b in breakdown
                    if b["status"] == "missing" and b["weight"] == "must"]
    skills = "\n".join(f"- {s.label} ({s.concept_id}) [{s.weight}]" for s in job.skills)
    cv_skills = "\n".join(f"- {s.label}: {s.evidence}" for s in candidate.skills)
    return (
        f"Question mix: {QUESTION_MIX}\n"
        f"Job skills:\n{skills}\n"
        f"Candidate skills with CV evidence:\n{strip_pii(cv_skills)}\n"
        f"Must-have skills missing from CV: {must_missing}\n"
        f"Employer assessment brief (internal assessment guidance):\n"
        f"{strip_pii(job.assessment_brief.strip()) or 'No additional guidance; use the job skills.'}"
    )


def generate_assessment(app: Application, job: Job, candidate: Candidate) -> Assessment:
    prompt = build_generation_prompt(
        job, candidate, [b.model_dump() for b in app.skill_breakdown]
    )
    result = llm.chat_json(
        "generate_assessment", prompts.load("generate_assessment"), prompt, GeneratedQuestions
    )
    questions = [q.model_copy(update={"id": f"q{i + 1}"}) for i, q in enumerate(result.questions)]
    return Assessment(id=f"asm-{uuid.uuid4().hex[:8]}", application_id=app.id, questions=questions)


def grade_multiple_choice(q: Question) -> float:
    return 1.0 if q.answer and q.correct and q.answer.strip().upper() == q.correct.upper() else 0.0


def grade_open(q: Question) -> tuple[float, str]:
    res = llm.chat_json(
        "grade_open",
        prompts.load("grade_open"),
        f"Question: {q.text}\nRubric: {q.rubric}\nAnswer: {q.answer}",
        GradeResult,
    )
    return res.score, res.reasoning


def grade_assessment(assessment: Assessment, answers: dict[str, str]) -> Assessment:
    graded = []
    for q in assessment.questions:
        q = q.model_copy(update={"answer": answers.get(q.id, "")})
        if q.format == "multiple_choice":
            q.score = grade_multiple_choice(q)
        elif q.answer:
            q.score, q.reasoning = grade_open(q)
        else:
            q.score, q.reasoning = 0.0, "No answer"
        graded.append(q)

    total = sum(q.score or 0 for q in graded) / len(graded) if graded else 0.0
    by_skill: dict[str, list[float]] = {}
    for q in graded:
        if q.concept_id:
            by_skill.setdefault(q.concept_id, []).append(q.score or 0)
    per_skill = {k: sum(v) / len(v) for k, v in by_skill.items()}
    return assessment.model_copy(
        update={"questions": graded, "total_score": total, "per_skill": per_skill}
    )
