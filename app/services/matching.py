"""Match score: 0.7 x skill coverage + 0.3 x semantic similarity (README section 8)."""
import math

from app import config
from app.models.schemas import CandidateSkill, JobSkill, SkillBreakdownItem

_CREDIT = {"explicit": 1.0, "inferred": config.INFERRED_CREDIT, "missing": 0.0}
_WEIGHT = {"must": config.MUST_WEIGHT, "nice": config.NICE_WEIGHT}


def cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity clamped to 0..1."""
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return max(0.0, min(1.0, sum(x * y for x, y in zip(a, b)) / (na * nb)))


def skill_breakdown(
    job_skills: list[JobSkill], cand_skills: list[CandidateSkill]
) -> list[SkillBreakdownItem]:
    have = {s.concept_id: s for s in cand_skills}
    items = []
    for js in job_skills:
        cs = have.get(js.concept_id)
        items.append(
            SkillBreakdownItem(
                concept_id=js.concept_id,
                label=js.label,
                weight=js.weight,
                status=cs.confidence if cs else "missing",
                evidence=cs.evidence if cs else None,
            )
        )
    return items


def coverage(breakdown: list[SkillBreakdownItem]) -> float:
    total = sum(_WEIGHT[i.weight] for i in breakdown)
    if total == 0:
        return 0.0
    return sum(_WEIGHT[i.weight] * _CREDIT[i.status] for i in breakdown) / total


def match_score(coverage_value: float, similarity: float) -> float:
    score = config.COVERAGE_WEIGHT * coverage_value + config.SIMILARITY_WEIGHT * similarity
    return max(0.0, min(1.0, score))


def compute_match(
    job_skills: list[JobSkill],
    cand_skills: list[CandidateSkill],
    job_embedding: list[float],
    cv_embedding: list[float],
) -> dict:
    breakdown = skill_breakdown(job_skills, cand_skills)
    cov = coverage(breakdown)
    sim = cosine(job_embedding, cv_embedding)
    return {
        "match_score": match_score(cov, sim),
        "coverage": cov,
        "similarity": sim,
        "skill_breakdown": breakdown,
    }
