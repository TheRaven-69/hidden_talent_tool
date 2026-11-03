"""AI Search queries against the existing `taxonomy` and `jobs` indexes.

Field names come from config: fill them in after README section 5.
Queries use the SAME embedding model that built the index.
"""
from functools import lru_cache

from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery

from app import config
from app.services import llm


@lru_cache
def _client(index: str) -> SearchClient:
    return SearchClient(config.SEARCH_ENDPOINT, index, DefaultAzureCredential())


def search_taxonomy(phrase: str, k: int = 5, odata_filter: str | None = None) -> list[dict]:
    """Top-k taxonomy concepts for a skill phrase (hybrid: keyword + vector)."""
    vec = llm.embed([phrase])[0]
    results = _client(config.TAXONOMY_INDEX).search(
        search_text=phrase,
        vector_queries=[
            VectorizedQuery(vector=vec, k_nearest_neighbors=k, fields=config.TAXONOMY_VECTOR_FIELD)
        ],
        filter=odata_filter or config.TAXONOMY_FILTER or None,
        top=k,
    )
    return [
        {
            "concept_id": r[config.TAXONOMY_ID_FIELD],
            "label": r[config.TAXONOMY_LABEL_FIELD],
            "definition": r.get("definition") or "",
        }
        for r in results
    ]


def search_jobs(query: str, top: int = 20) -> list[dict]:
    vec = llm.embed([query])[0]
    results = _client(config.JOBS_INDEX).search(
        search_text=query,
        vector_queries=[
            VectorizedQuery(vector=vec, k_nearest_neighbors=top, fields=config.JOBS_VECTOR_FIELD)
        ],
        select=["id", "title", "municipality", "sector"],
        top=top,
    )
    return [
        {"id": r["id"], "title": r.get("title", ""), "location": r.get("municipality", ""),
         "sector": r.get("sector", "")}
        for r in results
    ]
