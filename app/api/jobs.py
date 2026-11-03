import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Application,
    Candidate,
    Job,
    PublicJob,
    SuggestSkillsRequest,
    SuggestSkillsResponse,
)
from app.services import catalog, normalize, search, storage

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
    if q:
        return search.search_jobs(q)
    return [{k: v for k, v in doc.items() if k != "assessment_brief"}
            for doc in storage.list_all("jobs")]


@router.get("/jobs/{job_id}")
def job_details(job_id: str):
    """Read vacancy details without starting normalization or writing to Cosmos."""
    doc = storage.get("jobs", job_id)
    if doc is not None:
        fields = ("sector", "source", "source_url", "application_deadline")
        return {**PublicJob.model_validate(doc).model_dump(),
                **{key: doc[key] for key in fields if key in doc}}
    record = search.get_job_document(job_id)
    if record is None:
        raise HTTPException(404, "Job not found")
    return catalog.from_search(record)


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
