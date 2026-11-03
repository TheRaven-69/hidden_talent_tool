import pytest

from app import prompts

NAMES = ["extract_skills_job", "extract_skills_cv", "pick_concept", "generate_assessment", "grade_open"]


@pytest.mark.parametrize("name", NAMES)
def test_prompt_loads_and_comments_are_stripped(name):
    text = prompts.load(name)
    assert text
    assert "<!--" not in text and "-->" not in text
