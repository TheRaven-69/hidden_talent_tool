from unittest.mock import Mock
import pytest
from azure.core.exceptions import ResourceNotFoundError
from azure.cosmos.exceptions import CosmosResourceExistsError
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import Job, JobSkill
from app.services import catalog, profiles, recommendations, search, storage


@pytest.fixture
def memory(monkeypatch):
    db = {"jobs": {}, "candidates": {}}
    monkeypatch.setattr(storage, "get", lambda container, key: db[container].get(key))
    monkeypatch.setattr(storage, "list_all", lambda container: list(db[container].values()))
    monkeypatch.setattr(storage, "query", lambda container, *args: list(db[container].values()))
    def save(container, doc):
        db[container][doc["id"]] = dict(doc)
        return doc
    def create(container, doc):
        if doc["id"] in db[container]:
            return False
        save(container, doc)
        return True
    monkeypatch.setattr(storage, "upsert", save)
    monkeypatch.setattr(storage, "create_if_absent", create)
    return db


def test_sync_is_idempotent_preserves_existing_and_dates(memory, monkeypatch):
    record = {"id": "starter", "title": "Developer", "text": "Python", "municipality": ""}
    monkeypatch.setattr(search, "list_job_documents", lambda: [record])
    memory["jobs"]["employer"] = {"id": "employer", "skills": ["confirmed"]}
    assert catalog.sync_jobs()["would_create"] == 1
    assert len(memory["jobs"]) == 1
    assert catalog.sync_jobs(True, {"starter": {"application_deadline": "2026-12-01"}})["created"] == 1
    memory["jobs"]["starter"]["gate"] = .9
    assert catalog.sync_jobs(True)["created"] == 0
    assert memory["jobs"]["starter"]["gate"] == .9
    assert memory["jobs"]["starter"]["application_deadline"] == "2026-12-01"
    assert memory["jobs"]["employer"]["skills"] == ["confirmed"]


def test_ensure_imports_and_normalizes_once_even_empty(memory, monkeypatch):
    monkeypatch.setattr(search, "get_job_document", lambda key: {"id": key, "title": "Job", "text": "text"})
    normalize = Mock(return_value=[])
    monkeypatch.setattr(catalog.normalize, "normalize_job", normalize)
    assert catalog.ensure_job("starter").id == "starter"
    catalog.ensure_job("starter")
    normalize.assert_called_once()


def test_ensure_preserves_confirmed_job_and_missing(memory, monkeypatch, sample_job):
    memory["jobs"][sample_job.id] = sample_job.model_dump()
    monkeypatch.setattr(search, "get_job_document", lambda key: None)
    monkeypatch.setattr(catalog.normalize, "normalize_job", Mock(side_effect=AssertionError("must not normalize")))
    assert catalog.ensure_job(sample_job.id) == sample_job
    assert catalog.ensure_job("missing") is None


def test_profile_preserves_metadata_and_reuses_empty_normalization(memory, monkeypatch):
    memory["candidates"]["c"] = {"id": "c", "background_text": "Volunteer", "partition_key": "synthetic-candidates", "is_synthetic": True}
    normalizer = Mock(return_value=[])
    monkeypatch.setattr(profiles.normalize, "normalize_cv", normalizer)
    profiles.prepare_candidate("c", None)
    profiles.prepare_candidate("c", None)
    normalizer.assert_called_once()
    assert memory["candidates"]["c"]["is_synthetic"] is True
    assert memory["candidates"]["c"]["partition_key"] == "synthetic-candidates"
    with pytest.raises(LookupError):
        profiles.prepare_candidate("unknown", None)
    with pytest.raises(ValueError):
        profiles.prepare_candidate("c", "both inputs")
    with pytest.raises(ValueError):
        profiles.prepare_candidate(None, "  ")
    created = profiles.prepare_candidate(None, "New fictional profile")
    assert created.id in memory["candidates"]


def test_recommendations_use_skills_dedupe_include_local_and_score(memory, monkeypatch, sample_candidate, sample_job, mock_llm):
    memory["candidates"][sample_candidate.id] = sample_candidate.model_dump()
    local = sample_job.model_copy(update={"id": "local", "gate": .99})
    memory["jobs"]["local"] = local.model_dump()
    starter = sample_job.model_copy(update={"id": "starter"})
    memory["jobs"]["starter"] = {**starter.model_dump(), "source": "search"}
    unrelated = Job(id="other", title="Other", ad_text="Other", skills=[JobSkill(concept_id="other", label="Other")])
    memory["jobs"]["other"] = {**unrelated.model_dump(), "source": "search"}
    retrieve = Mock(return_value=[{"id": "starter"}, {"id": "starter"}, {"id": "other"}])
    monkeypatch.setattr(search, "search_jobs", retrieve)
    result = recommendations.recommend(sample_candidate.id)
    retrieve.assert_called_once_with("Python", top=5)
    assert result.evaluated_count == 3
    assert {r.job.id for r in result.recommendations} == {"starter", "local"}
    rows = {r.job.id: r for r in result.recommendations}
    assert rows["starter"].meets_score_gate
    assert not rows["local"].meets_score_gate
    assert rows["starter"].match_score == pytest.approx(.7 * 2 / 3 + .3)
    assert rows["starter"].skill_breakdown[0].evidence == "Built Django APIs"


def test_no_skills_does_not_search(memory, monkeypatch):
    memory["candidates"]["c"] = {"id": "c", "cv_text": "text", "skills_normalized": True}
    monkeypatch.setattr(search, "search_jobs", Mock(side_effect=AssertionError("no search")))
    assert recommendations.recommend("c").recommendations == []


def test_search_catalog_reads_and_not_found(monkeypatch):
    client = Mock()
    client.search.return_value = [{"id": "one"}]
    client.get_document.return_value = {"id": "one"}
    monkeypatch.setattr(search, "_client", lambda index: client)
    assert search.list_job_documents() == [{"id": "one"}]
    assert search.get_job_document("one") == {"id": "one"}
    client.get_document.side_effect = ResourceNotFoundError()
    assert search.get_job_document("absent") is None


def test_create_only_does_not_upsert_on_conflict(monkeypatch):
    container = Mock()
    monkeypatch.setattr(storage, "_container", lambda name: container)
    assert storage.create_if_absent("jobs", {"id": "one"})
    container.create_item.assert_called_with({"id": "one", "partition_key": "jobs"})
    container.create_item.side_effect = CosmosResourceExistsError()
    assert not storage.create_if_absent("jobs", {"id": "one"})
    container.upsert_item.assert_not_called()


def test_api_recommend_then_apply_uses_same_candidate(memory, monkeypatch, sample_job, sample_candidate, mock_llm):
    memory["applications"] = {}
    memory["jobs"][sample_job.id] = sample_job.model_dump()
    memory["candidates"][sample_candidate.id] = sample_candidate.model_dump()
    monkeypatch.setattr(search, "search_jobs", lambda *args, **kwargs: [])
    client = TestClient(app)
    r = client.post("/api/recommendations", json={"candidate_id": sample_candidate.id})
    assert r.status_code == 200
    recommendation = r.json()["recommendations"][0]
    applied = client.post("/api/applications", json={"candidate_id": r.json()["candidate_id"], "job_id": recommendation["job"]["id"]})
    assert applied.status_code == 200
    assert applied.json()["match_score"] == recommendation["match_score"]
    assert applied.json()["status"] == "assessment_invited"
    memory["jobs"][sample_job.id]["gate"] = 1.0
    below = client.post("/api/applications", json={"candidate_id": sample_candidate.id, "job_id": sample_job.id})
    assert below.status_code == 200
    assert below.json()["status"] == "below_gate"
    assert below.json()["id"] in memory["applications"]
    assert client.post("/api/recommendations", json={}).status_code == 400
    assert client.post("/api/recommendations", json={"candidate_id": "absent"}).status_code == 404


def test_job_details_reads_existing_or_search_without_writes(memory, monkeypatch, sample_job):
    memory["jobs"][sample_job.id] = {**sample_job.model_dump(), "application_deadline": "2026-12-01", "_etag": "private"}
    client = TestClient(app)
    result = client.get(f"/api/jobs/{sample_job.id}")
    assert result.status_code == 200
    assert result.json()["application_deadline"] == "2026-12-01"
    assert "_etag" not in result.json()
    monkeypatch.setattr(search, "get_job_document", lambda key: {"id": key, "title": "Starter", "text": "Original ad"})
    result = client.get("/api/jobs/starter")
    assert result.status_code == 200
    assert result.json()["ad_text"] == "Original ad"
    assert "starter" not in memory["jobs"]
    monkeypatch.setattr(search, "get_job_document", lambda key: None)
    assert client.get("/api/jobs/missing").status_code == 404


def test_employer_brief_is_saved_but_not_in_candidate_job_responses(memory, monkeypatch, sample_job, sample_candidate, mock_llm):
    client = TestClient(app)
    payload = {**sample_job.model_dump(), "assessment_brief": "Check input validation and error handling."}
    assert client.post("/api/jobs", json=payload).status_code == 200
    assert memory["jobs"][sample_job.id]["assessment_brief"] == payload["assessment_brief"]
    assert "assessment_brief" not in client.get(f"/api/jobs/{sample_job.id}").json()
    assert "assessment_brief" not in client.get("/api/jobs").json()[0]
    memory["candidates"][sample_candidate.id] = sample_candidate.model_dump()
    monkeypatch.setattr(search, "search_jobs", lambda *a, **kw: [])
    result = client.post("/api/recommendations", json={"candidate_id": sample_candidate.id})
    assert result.status_code == 200
    assert "assessment_brief" not in result.json()["recommendations"][0]["job"]
    assert Job.model_validate(sample_job.model_dump()).assessment_brief == ""
    assert client.post("/api/jobs", json={**payload, "assessment_brief": "x" * 6001}).status_code == 422


def test_generation_uses_brief_and_grading_uses_its_rubric(sample_job, sample_candidate, monkeypatch):
    from app.models.schemas import Application, GeneratedQuestions, GradeResult, Question
    from app.services import assessment, llm
    sample_job.assessment_brief = "Check input validation; good answers explain invalid-input handling."
    calls = []
    rubric = "Credit explaining validation and handling invalid input."
    def chat(purpose, system, user, schema):
        calls.append((purpose, user))
        if purpose == "generate_assessment":
            assert sample_job.assessment_brief in user
            return GeneratedQuestions(questions=[Question(id="draft", type="hard_skill", format="open", text="How would you validate input?", rubric=rubric, concept_id="py")])
        assert rubric in user
        return GradeResult(score=.8, reasoning="Explains validation.")
    monkeypatch.setattr(llm, "chat_json", chat)
    asm = assessment.generate_assessment(Application(id="app", job_id=sample_job.id, candidate_id=sample_candidate.id), sample_job, sample_candidate)
    graded = assessment.grade_assessment(asm, {"q1": "I would validate the expected type and return an error."})
    assert graded.total_score == .8
    assert [purpose for purpose, _ in calls] == ["generate_assessment", "grade_open"]
    assert "No additional guidance" in assessment.build_generation_prompt(sample_job.model_copy(update={"assessment_brief": ""}), sample_candidate, [])


def test_candidate_assessment_hides_keys_and_rubrics_but_keeps_them_stored(memory, monkeypatch, sample_job, sample_candidate):
    from app.models.schemas import Assessment, Question
    from app.services import assessment
    memory["jobs"][sample_job.id] = sample_job.model_dump()
    memory["candidates"][sample_candidate.id] = sample_candidate.model_dump()
    memory["applications"] = {"app": {"id": "app", "job_id": sample_job.id, "candidate_id": sample_candidate.id, "status": "assessment_invited"}}
    memory["assessments"] = {}
    asm = Assessment(id="asm", application_id="app", questions=[Question(id="q1", type="hard_skill", format="multiple_choice", text="Question", options=["A", "B"], correct="B", rubric="Internal criteria")])
    monkeypatch.setattr(assessment, "generate_assessment", lambda *args: asm)
    client = TestClient(app)
    created = client.post("/api/assessments/app")
    assert created.status_code == 200
    assert "correct" not in created.json()["questions"][0]
    assert "rubric" not in created.json()["questions"][0]
    assert memory["assessments"]["asm"]["questions"][0]["correct"] == "B"
    graded = client.post("/api/assessments/asm/submit", json={"answers": {"q1": "B"}})
    assert graded.json()["total_score"] == 1
    assert "rubric" not in graded.json()["questions"][0]
