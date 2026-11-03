import pytest

from app.models.schemas import Candidate, CandidateSkill, Job, JobSkill


@pytest.fixture
def sample_job():
    return Job(
        id="job-001",
        title="Backend Developer",
        ad_text="Python backend developer",
        skills=[
            JobSkill(concept_id="py", label="Python", weight="must"),
            JobSkill(concept_id="arch", label="Systemarkitektur", weight="nice"),
        ],
    )


@pytest.fixture
def sample_candidate():
    return Candidate(
        id="cand-001",
        cv_text="Built Django APIs",
        skills=[CandidateSkill(concept_id="py", label="Python", confidence="explicit", evidence="Built Django APIs")],
    )


@pytest.fixture
def mock_llm(monkeypatch):
    """Patch llm.chat_json / llm.embed with canned responses per test."""
    from app.services import llm

    class Mock:
        responses = {}

        def chat_json(self, purpose, system, user, schema, use_cache=True):
            return self.responses[purpose]

        def embed(self, texts):
            return [[1.0, 0.0] for _ in texts]

    m = Mock()
    monkeypatch.setattr(llm, "chat_json", m.chat_json)
    monkeypatch.setattr(llm, "embed", m.embed)
    return m
