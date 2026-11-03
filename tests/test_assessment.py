import pytest

from app.models.schemas import Question
from app.services import assessment


def test_grade_multiple_choice():
    q = Question(id="q1", type="hard_skill", format="multiple_choice", text="?", correct="B", answer="b")
    assert assessment.grade_multiple_choice(q) == 1.0
    q.answer = "A"
    assert assessment.grade_multiple_choice(q) == 0.0


@pytest.mark.skip(reason="TODO: question mix per section 9 (mock llm.chat_json)")
def test_question_mix():
    ...


@pytest.mark.skip(reason="TODO: rubric grading via mocked LLM, per_skill aggregation")
def test_rubric_grading():
    ...
