import pytest


@pytest.mark.skip(reason="TODO: Cosmos/Blob read-write with mocked clients")
def test_upsert_and_get():
    ...


def test_candidate_reads_background_text_and_keeps_partition_key():
    from app.models.schemas import Candidate

    c = Candidate.model_validate(
        {"id": "candidate-001", "background_text": "I volunteer", "partition_key": "synthetic-candidates", "language": "en"}
    )
    assert c.cv_text == "I volunteer"
    assert c.model_dump()["partition_key"] == "synthetic-candidates"
