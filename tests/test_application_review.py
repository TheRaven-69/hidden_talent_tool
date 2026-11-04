import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import storage, catalog, profiles, matching, llm


@pytest.fixture
def review_db(monkeypatch):
    db = {name: {} for name in ("applications", "jobs", "candidates", "assessments")}
    monkeypatch.setattr(storage, "list_all", lambda name: list(db[name].values()))
    monkeypatch.setattr(storage, "get", lambda name, key: db[name].get(key))
    monkeypatch.setattr(storage, "upsert", lambda name, doc: db[name].update({doc["id"]: doc}))
    monkeypatch.setattr(storage, "query", lambda name, sql, params:
                        [doc for doc in db[name].values() if doc["job_id"] == params[0]["value"]])
    db["applications"]["a"] = {"id": "a", "job_id": "j", "candidate_id": "c",
        "skill_breakdown": [{"concept_id": "py", "label": "Python", "status": "explicit", "evidence": "Built APIs"},
                            {"concept_id": "sql", "label": "SQL", "status": "missing"}]}
    db["jobs"]["j"] = {"id": "j", "title": "Developer"}
    db["candidates"]["c"] = {"id": "c", "background_text": "Original CV"}
    return db


def test_legacy_review_uses_profile_and_saved_evidence(review_db):
    response = TestClient(app).get("/api/employer/applications")
    assert response.status_code == 200
    row = response.json()[0]
    assert row["cv_text"] == "Original CV"
    assert row["cv_source"] == "current_profile"
    assert row["cv_summary"] == {"explicit": ["Python"], "inferred": [], "missing_required": ["SQL"]}
    assert row["assessment_state"] == "not_started"
    assert row["assessment"] is None


def test_detail_endpoint_and_missing_application(review_db):
    client = TestClient(app)
    detail = client.get("/api/employer/applications/a")
    assert detail.status_code == 200
    assert detail.json()["application"]["id"] == "a"
    assert detail.json()["cv_text"] == "Original CV"
    assert client.get("/api/employer/applications/unknown").status_code == 404


def test_zero_completed_score_beats_unfinished_attempt_and_hides_keys(review_db):
    review_db["assessments"] = {
        "done": {"id": "done", "application_id": "a", "total_score": 0, "_ts": 1,
                 "questions": [{"id": "q", "type": "hard_skill", "format": "multiple_choice",
                                "text": "Test", "correct": "B", "rubric": "secret", "answer": "A", "score": 0}]},
        "new": {"id": "new", "application_id": "a", "_ts": 2}}
    row = TestClient(app).get("/api/employer/applications").json()[0]
    assert row["assessment_state"] == "completed"
    assert row["assessment"]["id"] == "done"
    assert row["assessment"]["total_score"] == 0
    assert row["attempt_count"] == 2
    assert "correct" not in row["assessment"]["questions"][0]
    assert "rubric" not in row["assessment"]["questions"][0]


def test_snapshot_survives_profile_changes_and_missing_job(review_db):
    review_db["applications"]["a"]["candidate_snapshot"] = {"id": "c", "cv_text": "Saved CV"}
    review_db["candidates"]["c"]["background_text"] = "Updated CV"
    review_db["jobs"].clear()
    row = TestClient(app).get("/api/employer/applications").json()[0]
    assert row["cv_text"] == "Saved CV"
    assert row["cv_source"] == "submission"
    assert row["job"]["available"] is False


def test_filters_empty_and_missing_candidate(review_db):
    client = TestClient(app)
    assert client.get("/api/employer/applications?job_id=other").json() == []
    review_db["candidates"].clear()
    row = client.get("/api/employer/applications?job_id=j").json()[0]
    assert row["cv_source"] == "unavailable"
    review_db["applications"].clear()
    assert client.get("/api/employer/applications").json() == []


def test_submission_saves_snapshot(review_db, monkeypatch, sample_candidate, sample_job):
    monkeypatch.setattr(catalog, "ensure_job", lambda _: sample_job)
    monkeypatch.setattr(profiles, "prepare_candidate", lambda *args: sample_candidate)
    monkeypatch.setattr(llm, "embed", lambda _: [[1], [1]])
    monkeypatch.setattr(matching, "compute_match", lambda *args: {"match_score": .8})
    response = TestClient(app).post("/api/applications", json={"job_id": sample_job.id, "candidate_id": sample_candidate.id, "full_name": "  Alex Andersson  "})
    assert response.status_code == 200
    saved = review_db["applications"][response.json()["id"]]
    assert saved["submitted_at"]
    assert saved["candidate_snapshot"]["cv_text"] == sample_candidate.cv_text
    assert saved["full_name"] == "Alex Andersson"
    rows = TestClient(app).get("/api/employer/applications").json()
    assert next(r for r in rows if r["application"]["id"] == saved["id"])["application"]["full_name"] == "Alex Andersson"


@pytest.mark.parametrize("name", ["   ", "x" * 201])
def test_invalid_full_name_is_rejected_before_processing(name):
    assert TestClient(app).post("/api/applications", json={"job_id": "j", "full_name": name}).status_code == 422
