import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Application,
    Candidate,
    Job,
    SuggestSkillsRequest,
    SuggestSkillsResponse,
)
from app.services import normalize, search, storage

router = APIRouter(tags=["jobs"])


@router.post("/jobs/suggest-skills", response_model=SuggestSkillsResponse)
def suggest_skills(req: SuggestSkillsRequest):
    return SuggestSkillsResponse(skills=normalize.normalize_job(req.ad_text))


@router.post("/jobs", response_model=Job)
def create_job(job: Job):
    if not job.id:
        job.id = f"job-{uuid.uuid4().hex[:8]}"
    storage.upsert("jobs", job.model_dump())
    return job


@router.get("/jobs")
def list_jobs(q: Optional[str] = None):
    return search.search_jobs(q) if q else storage.list_all("jobs")


@router.get("/jobs/{job_id}/candidates")
def ranked_candidates(job_id: str):
    """Employer dashboard: applications sorted by match score, with candidate skills."""
    if not storage.get("jobs", job_id):
        raise HTTPException(404, "Job not found")
    apps = storage.query(
        "applications", "SELECT * FROM c WHERE c.job_id = @j", [{"name": "@j", "value": job_id}]
    )
    apps.sort(key=lambda a: a.get("match_score", 0), reverse=True)
    out = []
    for a in apps:
        asm = storage.query(
            "assessments",
            "SELECT * FROM c WHERE c.application_id = @a",
            [{"name": "@a", "value": a["id"]}],
        )
        out.append({"application": a, "assessment": asm[0] if asm else None})
    return out
