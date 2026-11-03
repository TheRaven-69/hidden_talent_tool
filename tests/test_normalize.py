import pytest

from app.services import normalize


def test_strip_pii_removes_email_and_phone():
    out = normalize.strip_pii("Mail anna@example.com or call +46 70 123 45 67")
    assert "anna@example.com" not in out
    assert "123 45 67" not in out


def test_pick_concept_rejects_invented_id(mock_llm):
    from app.models.schemas import PickedConcept

    mock_llm.responses["pick_concept"] = PickedConcept(concept_id="made-up")
    assert normalize.pick_concept("python", [{"concept_id": "py", "label": "Python"}]) is None


def test_pick_concept_returns_choice(mock_llm):
    from app.models.schemas import PickedConcept

    mock_llm.responses["pick_concept"] = PickedConcept(concept_id="py")
    c = normalize.pick_concept("python", [{"concept_id": "py", "label": "Python"}])
    assert c["label"] == "Python"


@pytest.mark.skip(reason="TODO: extract -> search -> pick end-to-end with mocked search")
def test_none_when_no_concept_fits():
    ...
