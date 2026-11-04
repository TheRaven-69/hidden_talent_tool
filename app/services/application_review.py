"""Read-only employer review, using saved evidence rather than new AI claims."""
from app.models.schemas import Application, Assessment, Candidate
from app.services import storage


def list_reviews(job_id: str | None = None, application_id: str | None = None) -> list[dict]:
    if application_id is not None:
        doc = storage.get("applications", application_id)
        apps = [doc] if doc else []
    else:
        apps = (storage.query("applications", "SELECT * FROM c WHERE c.job_id = @j",
                              [{"name": "@j", "value": job_id}])
                if job_id else storage.list_all("applications"))
    if not apps:
        return []
    # Batch reads avoid one Cosmos request for each application in the prototype.
    jobs = {j["id"]: j for j in storage.list_all("jobs")}
    candidates = {c["id"]: c for c in storage.list_all("candidates")}
    assessments: dict[str, list[dict]] = {}
    for assessment in storage.list_all("assessments"):
        assessments.setdefault(assessment["application_id"], []).append(assessment)
    reviews = []
    for doc in apps:
        application = Application.model_validate(doc)
        job = jobs.get(application.job_id)
        candidate = application.candidate_snapshot
        source = "submission" if candidate is not None else "current_profile"
        if candidate is None and application.candidate_id in candidates:
            candidate = Candidate.model_validate(candidates[application.candidate_id])
        attempts = assessments.get(application.id, [])
        completed = [a for a in attempts if a.get("total_score") is not None]
        # Never let an unfinished attempt hide a completed result; zero is a result.
        selected = max(completed or attempts,
                       key=lambda a: (a.get("completed_at") or "", a.get("_ts", 0), a["id"]),
                       default=None)
        assessment = Assessment.model_validate(selected) if selected else None
        explicit = [s.label for s in application.skill_breakdown if s.status == "explicit"]
        inferred = [s.label for s in application.skill_breakdown if s.status == "inferred"]
        missing = [s.label for s in application.skill_breakdown
                   if s.status == "missing" and s.weight == "must"]
        state = "completed" if completed else "in_progress" if attempts else "not_started"
        reviews.append({
            "application": application.model_dump(exclude={"candidate_snapshot"}),
            "job": {"id": application.job_id, "title": job["title"] if job else application.job_id,
                    "available": job is not None},
            "cv_text": candidate.cv_text if candidate else None,
            "cv_source": source if candidate else "unavailable",
            "cv_summary": {"explicit": explicit, "inferred": inferred, "missing_required": missing},
            "assessment_state": state,
            "assessment": assessment.model_dump(exclude={"questions": {"__all__": {"correct", "rubric"}}})
                          if assessment else None,
            "attempt_count": len(attempts),
        })
    return sorted(reviews, key=lambda r: (r["application"]["submitted_at"] or "",
                                         r["application"]["id"]), reverse=True)
