"""Preview catalog sync; --apply inserts missing jobs without replacing any documents."""
import argparse
import json
from pathlib import Path
from app.services.catalog import sync_jobs

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--metadata", type=Path, help="Optional starter job_ads.json for dates")
    args = parser.parse_args()
    metadata = None
    if args.metadata:
        metadata = {r["id"]: r for r in json.loads(args.metadata.read_text(encoding="utf-8"))}
    print(json.dumps(sync_jobs(apply=args.apply, metadata=metadata)))
