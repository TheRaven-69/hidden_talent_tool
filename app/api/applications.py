import uuid

from fastapi import APIRouter, HTTPException

from app.models.schemas import Application, ApplyRequest, Candidate, Job
from app.services import llm, matching, normalize, storage

router = APIRouter(tags=["applications"])


@router.post("/applications", response_model=Application)
def apply(req: ApplyRequest):
    job_doc = storage.get("jobs", req.job_id)
    if not job_doc:
        raise HTTPException(404, "Job not found")
    job = Job.model_validate(job_doc)

    if req.candidate_id:  # mock profile
        cand_doc = storage.get("candidates", req.candidate_id)
        if not cand_doc:
            raise HTTPException(404, "Candidate not found")
        candidate = Candidate.model_validate(cand_doc)
    elif req.cv_text:
        candidate = Candidate(id=f"cand-{uuid.uuid4().hex[:8]}", cv_text=req.cv_text)
    else:
        raise HTTPException(400, "Provide candidate_id or cv_text")

    if not candidate.skills:
        candidate.skills = normalize.normalize_cv(candidate.cv_text)
        storage.upsert("candidates", candidate.model_dump())

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
