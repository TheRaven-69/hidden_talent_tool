"""Resolve and normalize a profile while preserving its existing Cosmos metadata."""
import uuid
from app.models.schemas import Candidate
from app.services import normalize, storage


def prepare_candidate(candidate_id: str | None, cv_text: str | None) -> Candidate:
    if bool(candidate_id) == bool(cv_text and cv_text.strip()):
        raise ValueError("Provide either candidate_id or non-empty cv_text")
    if candidate_id:
        doc = storage.get("candidates", candidate_id)
        if doc is None:
            raise LookupError("Candidate not found")
    else:
        doc = {"id": f"cand-{uuid.uuid4().hex[:8]}", "cv_text": cv_text.strip()}
    candidate = Candidate.model_validate(doc)
    if not candidate.skills and not doc.get("skills_normalized", False):
        candidate.skills = normalize.normalize_cv(candidate.cv_text)
        doc.update(skills=[s.model_dump() for s in candidate.skills], skills_normalized=True)
        storage.upsert("candidates", doc)
    return candidate
