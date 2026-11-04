"""Skill-led retrieval followed by the same scoring used when applying."""
from app.models.schemas import JobRecommendation, RecommendationResponse
from app.services import catalog, llm, matching, normalize, profiles, search, storage


def recommend(candidate_id: str | None = None, cv_text: str | None = None) -> RecommendationResponse:
    candidate = profiles.prepare_candidate(candidate_id, cv_text)
    response = RecommendationResponse(candidate_id=candidate.id, skills=candidate.skills,
                                      recommendations=[], evaluated_count=0)
    if not candidate.skills:
        return response
    # Labels come from the Swedish taxonomy, not the profile's preferences or desired job.
    query = "; ".join(dict.fromkeys(s.label for s in candidate.skills))
    hits = search.search_jobs(query, top=5)
    ids = list(dict.fromkeys(h["id"] for h in hits))
    # Employer-created jobs are not in the read-only starter index. Include them too.
    for doc in storage.list_all("jobs"):
        if doc.get("source") != "search" and doc["id"] not in ids:
            ids.append(doc["id"])
    jobs = [job for job_id in ids if (job := catalog.ensure_job(job_id)) is not None]
    if not jobs:
        return response
    vectors = llm.embed([normalize.strip_pii(candidate.cv_text)] +
                        [normalize.strip_pii(j.ad_text) for j in jobs])
    ranked = []
    for job, vector in zip(jobs, vectors[1:]):
        result = matching.compute_match(job.skills, candidate.skills, vector, vectors[0])
        # Similar prose alone is not enough to recommend a job as a skill match.
        if result["coverage"] <= 0:
            continue
        ranked.append(JobRecommendation(job=job, **result,
                      meets_score_gate=result["match_score"] >= job.gate))
    ranked.sort(key=lambda r: (-r.match_score, r.job.id))
    response.recommendations = ranked[:3]
    response.evaluated_count = len(jobs)
    return response
