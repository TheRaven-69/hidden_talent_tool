"""Check that every Azure dependency is reachable with your current login.

Usage: python -m scripts.smoke_check
Prints OK/FAIL per service and exits non-zero if anything failed.
"""
import sys

from azure.cosmos.exceptions import CosmosResourceNotFoundError
from pydantic import BaseModel

from app import config
from app.services import llm, search, storage


class _Pong(BaseModel):
    reply: str


def _chat():
    r = llm.chat_json("smoke", "Reply with the single word: pong", "ping", _Pong, use_cache=False)
    return f"reply={r.reply!r}"


def _embed():
    return f"dimensions={len(llm.embed(['hej'])[0])}"


def _taxonomy():
    hits = search.search_taxonomy("kundservice")
    if not hits:
        raise RuntimeError("no results - check TAXONOMY_* settings and that the index has data")
    return ", ".join(f"{h['label']} ({h['concept_id']})" for h in hits[:3])


def _jobs():
    return f"{len(search.search_jobs('lager', top=3))} hits"


def _cosmos():
    out, missing = [], []
    for c in storage.CONTAINERS:
        try:
            out.append(f"{c}={len(storage.query(c, 'SELECT c.id FROM c'))}")
        except CosmosResourceNotFoundError:
            missing.append(config.COSMOS_CONTAINERS[c])
    if missing:
        raise RuntimeError(f"containers not found: {', '.join(missing)} (found: {', '.join(out) or 'none'})")
    return "docs per container: " + ", ".join(out)


CHECKS = [
    ("Foundry chat", _chat),
    ("Foundry embeddings", _embed),
    ("AI Search taxonomy", _taxonomy),
    ("AI Search jobs", _jobs),
    ("Cosmos DB", _cosmos),
]


def main() -> int:
    missing = [n for n in ("AZURE_OPENAI_ENDPOINT", "SEARCH_ENDPOINT", "COSMOS_ENDPOINT") if not getattr(config, n)]
    if missing:
        print("FAIL missing settings in .env:", ", ".join(missing))
        return 1
    failed = 0
    for name, fn in CHECKS:
        try:
            print(f"OK   {name}: {fn()}")
        except Exception as e:  # noqa: BLE001 - report and continue
            failed += 1
            print(f"FAIL {name}: {type(e).__name__}: {str(e)[:200]}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
