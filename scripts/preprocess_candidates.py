"""Load the 100 mock English candidate profiles: normalize skills and save to Cosmos `candidates`.

Usage: python -m scripts.preprocess_candidates path/to/candidates.json [--limit N]

Input fields used: id, background_text, partition_key (kept so the Cosmos upsert works if the
container is partitioned on /partition_key), language, is_synthetic.
"""
import argparse
import json

from app.models.schemas import Candidate
from app.services import normalize, storage


def main(path: str, limit: int | None) -> None:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    for i, item in enumerate(raw[:limit]):
        cand = Candidate.model_validate({"id": f"cand-{i:03d}", **item})
        cand.skills = normalize.normalize_cv(cand.cv_text)
        doc = cand.model_dump()
        doc.update(
            language=item.get("language", "en"),
            is_synthetic=item.get("is_synthetic", True),
        )
        storage.upsert("candidates", doc)
        print("saved", cand.id, len(cand.skills), "skills")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--limit", type=int, default=None, help="process only the first N (for a cheap test run)")
    args = ap.parse_args()
    main(args.path, args.limit)
