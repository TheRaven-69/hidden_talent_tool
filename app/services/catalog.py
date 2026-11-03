"""Bridge the read-only Search catalog and application documents in Cosmos."""
from app.models.schemas import Job
from app.services import normalize, search, storage


def from_search(record: dict) -> dict:
    job = Job(id=record["id"], title=record["title"],
              ad_text=record["text"], location=record.get("municipality") or "")
    return {**job.model_dump(), "source": "search", "skills_normalized": False,
            "sector": record.get("sector", ""), "source_url": record.get("source_url", "")}


def sync_jobs(apply: bool = False, metadata: dict | None = None) -> dict:
    existing = {r["id"] for r in storage.query("jobs", "SELECT c.id FROM c")}
    records = search.list_job_documents()
    added = skipped = 0
    for record in records:
        if record["id"] in existing:
            skipped += 1
            continue
        doc = from_search(record)
        extra = (metadata or {}).get(doc["id"], {})
        for field in ("application_deadline", "publication_date"):
            if field in extra:
                doc[field] = extra[field]
        if not apply or storage.create_if_absent("jobs", doc):
            added += 1
        else:
            skipped += 1
    return {"search_documents": len(records), "existing": skipped,
            "created" if apply else "would_create": added}


def ensure_job(job_id: str) -> Job | None:
    doc = storage.get("jobs", job_id)
    if doc is None:
        record = search.get_job_document(job_id)
        if record is None:
            return None
        storage.create_if_absent("jobs", from_search(record))
        doc = storage.get("jobs", job_id)
    # Empty successful normalization is cached too; employer-confirmed skills stay intact.
    if not doc.get("skills") and not doc.get("skills_normalized", False):
        doc["skills"] = [s.model_dump() for s in normalize.normalize_job(doc["ad_text"])]
        doc["skills_normalized"] = True
        storage.upsert("jobs", doc)
    return Job.model_validate(doc)
