"""Load the 200 mock Swedish job ads: normalize skills and save to Cosmos `jobs`.

Usage: python -m scripts.preprocess_jobs path/to/job_ads.json [--limit N]

Input fields used: id, title, municipality, description (`text` = title + description, so we
use `description`). `taxonomy_ids` in the file are occupation-level tags, not a skill list, so
they are NOT used as the job's skills; the pipeline extracts skills from the text instead.
"""
import argparse
import json

from app.models.schemas import Job
from app.services import normalize, storage


def main(path: str, limit: int | None) -> None:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    for i, item in enumerate(raw[:limit]):
        job = Job(
            id=item.get("id", f"job-{i:03d}"),
            title=item.get("title", ""),
            location=item.get("municipality", ""),
            ad_text=item.get("description") or item.get("ad_text", ""),
        )
        job.skills = normalize.normalize_job(job.ad_text)
        doc = job.model_dump()
        # Extra metadata for filtering/evaluation; not used for matching.
        doc.update(
            sector=item.get("sector"),
            application_deadline=item.get("application_deadline"),
            source_url=item.get("source_url"),
            source_taxonomy_ids=item.get("taxonomy_ids", []),
        )
        storage.upsert("jobs", doc)
        print("saved", job.id, len(job.skills), "skills")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--limit", type=int, default=None, help="process only the first N (for a cheap test run)")
    args = ap.parse_args()
    main(args.path, args.limit)
