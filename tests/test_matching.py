import pytest

from app.models.schemas import CandidateSkill, JobSkill
from app.services import matching


def _job(*pairs):
    return [JobSkill(concept_id=c, label=c, weight=w) for c, w in pairs]


def _cand(*pairs):
    return [CandidateSkill(concept_id=c, label=c, confidence=conf, evidence="q") for c, conf in pairs]


def test_explicit_must_have_counts_fully():
    b = matching.skill_breakdown(_job(("a", "must")), _cand(("a", "explicit")))
    assert matching.coverage(b) == 1.0


def test_inferred_skill_counts_half():
    b = matching.skill_breakdown(_job(("a", "must")), _cand(("a", "inferred")))
    assert matching.coverage(b) == 0.5


def test_missing_skill_counts_zero():
    b = matching.skill_breakdown(_job(("a", "must")), [])
    assert b[0].status == "missing"
    assert matching.coverage(b) == 0.0


def test_must_weighs_double_nice():
    # must covered, nice missing -> 2/3
    b = matching.skill_breakdown(_job(("a", "must"), ("b", "nice")), _cand(("a", "explicit")))
    assert matching.coverage(b) == pytest.approx(2 / 3)


def test_match_score_between_0_and_1():
    assert 0 <= matching.match_score(1.0, 1.0) <= 1
    assert 0 <= matching.match_score(0.0, 0.0) <= 1
    assert matching.match_score(1.0, 1.0) == pytest.approx(1.0)


def test_cosine_identical_and_zero_vectors():
    assert matching.cosine([1, 0], [1, 0]) == pytest.approx(1.0)
    assert matching.cosine([0, 0], [1, 0]) == 0.0
