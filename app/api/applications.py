import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.models.schemas import Application, ApplyRequest
from app.services import llm, matching, normalize, storage
from app.services import catalog, profiles

router = APIRouter(tags=["applications"])


@router.get("/employer/applications")
def employer_applications(job_id: str | None = None):
    from app.services.application_review import list_reviews
    return list_reviews(job_id)


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
        full_name=req.full_name,
        submitted_at=datetime.now(timezone.utc).isoformat(),
        candidate_snapshot=candidate.model_copy(deep=True),
        status="assessment_invited" if m["match_score"] >= job.gate else "below_gate",
        **m,
    )
    storage.upsert("applications", app.model_dump())
    return app


@router.get("/employer/applications/{application_id}")
def employer_application(application_id: str):
    from app.services.application_review import list_reviews
    rows = list_reviews(application_id=application_id)
    if not rows:
        raise HTTPException(404, "Application not found")
    return rows[0]
