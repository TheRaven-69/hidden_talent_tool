"""Prompt loader.

Prompts live in app/prompts/*.md so they can be edited and reviewed without touching
Python. Everything inside <!-- ... --> is a comment for humans and is stripped before the
text is sent to the model. Because the stripped text is part of the cache key in
llm.chat_json, editing a prompt automatically invalidates its cached results.
"""
import re
from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).parent
_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


@lru_cache
def load(name: str) -> str:
    text = _COMMENT.sub("", (_DIR / f"{name}.md").read_text(encoding="utf-8")).strip()
    if not text:
        raise ValueError(f"Prompt '{name}' is empty - write it in app/prompts/{name}.md")
    return text
