"""Skill normalization: extract -> search -> pick. Used for both jobs and CVs."""
import re
from typing import Literal

from app.models.schemas import (
    CandidateSkill,
    ExtractedSkills,
    JobSkill,
    PickedConcept,
)
from app import prompts
from app.services import llm, search

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


def strip_pii(text: str) -> str:
    """Basic redaction of contact details before any LLM scoring (README rule 9).
    TODO: also strip names/age/gender; extend as needed."""
    return _PHONE.sub("[phone]", _EMAIL.sub("[email]", text))


def extract_skills(text: str, kind: Literal["job", "cv"]) -> ExtractedSkills:
    system = prompts.load(f"extract_skills_{kind}")
    return llm.chat_json("extract_skills", system, strip_pii(text), ExtractedSkills)


def pick_concept(phrase: str, candidates: list[dict]) -> dict | None:
    """Let the LLM choose among search results. Returns None for 'none' or an unknown id."""
    if not candidates:
        return None
    options = "\n".join(
        f"- {c['concept_id']}: {c['label']}"
        + (f" - {c['definition'][:200]}" if c.get("definition") else "")
        for c in candidates
    )
    picked = llm.chat_json(
        "pick_concept",
        prompts.load("pick_concept"),
        f"Phrase: {phrase}\nCandidates:\n{options}",
        PickedConcept,
    )
    by_id = {c["concept_id"]: c for c in candidates}
    return by_id.get(picked.concept_id)  # guards against invented ids


def normalize_job(ad_text: str) -> list[JobSkill]:
    """Suggested skills for a job ad; employer confirms must/nice in the UI."""
    skills: dict[str, JobSkill] = {}
    for item in extract_skills(ad_text, "job").skills:
        concept = pick_concept(item.phrase, search.search_taxonomy(item.phrase))
        if concept:
            skills.setdefault(
                concept["concept_id"],
                JobSkill(concept_id=concept["concept_id"], label=concept["label"], weight="must"),
            )
    return list(skills.values())


def normalize_cv(cv_text: str) -> list[CandidateSkill]:
    skills: dict[str, CandidateSkill] = {}
    for item in extract_skills(cv_text, "cv").skills:
        concept = pick_concept(item.phrase, search.search_taxonomy(item.phrase))
        if not concept:
            continue
        cid = concept["concept_id"]
        prev = skills.get(cid)
        if prev and prev.confidence == "explicit":
            continue  # explicit beats inferred
        skills[cid] = CandidateSkill(
            concept_id=cid, label=concept["label"], confidence=item.confidence, evidence=item.evidence
        )
    return list(skills.values())
