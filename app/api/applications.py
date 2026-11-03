import uuid

from fastapi import APIRouter, HTTPException

from app.models.schemas import Application, ApplyRequest
from app.services import llm, matching, normalize, storage
from app.services import catalog, profiles

router = APIRouter(tags=["applications"])


@router.post("/applications", response_model=Application)
def apply(req: ApplyRequest):
    job = catalog.ensure_job(req.job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    try:
        candidate = profiles.prepare_candidate(req.candidate_id, req.cv_text)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    job_emb, cv_emb = llm.embed([normalize.strip_pii(job.ad_text), normalize.strip_pii(candidate.cv_text)])
    m = matching.compute_match(job.skills, candidate.skills, job_emb, cv_emb)
    app = Application(
        id=f"app-{uuid.uuid4().hex[:8]}",
        job_id=job.id,
        candidate_id=candidate.id,
        status="assessment_invited" if m["match_score"] >= job.gate else "below_gate",
        **m,
    )
    storage.upsert("applications", app.model_dump())
    return app
