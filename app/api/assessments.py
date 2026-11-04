from fastapi import APIRouter, HTTPException

from app.models.schemas import Application, Assessment, Candidate, Job, SubmitAnswersRequest
from app.services import assessment as svc
from app.services import storage

router = APIRouter(tags=["assessments"])


@router.post("/assessments/{application_id}", response_model=Assessment,
             response_model_exclude={"questions": {"__all__": {"correct", "rubric"}}})
def create_assessment(application_id: str):
    app_doc = storage.get("applications", application_id)
    if not app_doc:
        raise HTTPException(404, "Application not found")
    app = Application.model_validate(app_doc)
    if app.status == "below_gate":
        raise HTTPException(403, "Match score is below the employer's gate")
    job = Job.model_validate(storage.get("jobs", app.job_id))
    candidate = Candidate.model_validate(storage.get("candidates", app.candidate_id))
    asm = svc.generate_assessment(app, job, candidate)
    storage.upsert("assessments", asm.model_dump())
    return asm


@router.post("/assessments/{assessment_id}/submit", response_model=Assessment,
             response_model_exclude={"questions": {"__all__": {"correct", "rubric"}}})
def submit(assessment_id: str, req: SubmitAnswersRequest):
    doc = storage.get("assessments", assessment_id)
    if not doc:
        raise HTTPException(404, "Assessment not found")
    graded = svc.grade_assessment(Assessment.model_validate(doc), req.answers)
    storage.upsert("assessments", graded.model_dump())
    app = storage.get("applications", graded.application_id)
    if app:
        app["status"] = "assessed"
        storage.upsert("applications", app)
    return graded
