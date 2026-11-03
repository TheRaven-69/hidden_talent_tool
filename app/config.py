"""Configuration from environment variables only (no secrets in code)."""
import os

from dotenv import load_dotenv

load_dotenv()  # local development: reads .env (gitignored); in Azure the env vars are set on the app


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


AZURE_OPENAI_ENDPOINT = _env("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_VERSION = _env("AZURE_OPENAI_API_VERSION", "2025-04-01-preview")
CHAT_DEPLOYMENT = _env("CHAT_DEPLOYMENT", "gpt-5-mini")
EMBEDDING_DEPLOYMENT = _env("EMBEDDING_DEPLOYMENT", "text-embedding-3-small")

SEARCH_ENDPOINT = _env("SEARCH_ENDPOINT")
TAXONOMY_INDEX = _env("TAXONOMY_INDEX", "taxonomy")
JOBS_INDEX = _env("JOBS_INDEX", "jobs")
TAXONOMY_ID_FIELD = _env("TAXONOMY_ID_FIELD", "id")
TAXONOMY_LABEL_FIELD = _env("TAXONOMY_LABEL_FIELD", "preferred_label")
# The taxonomy index mixes skills with occupations and SSYK groups; only skills may be matched.
# (The index has no is_deprecated field, so deprecated skills cannot be filtered out here.)
TAXONOMY_FILTER = _env("TAXONOMY_FILTER", "type eq 'skill'")
TAXONOMY_VECTOR_FIELD = _env("TAXONOMY_VECTOR_FIELD", "vector")
JOBS_VECTOR_FIELD = _env("JOBS_VECTOR_FIELD", "vector")

COSMOS_ENDPOINT = _env("COSMOS_ENDPOINT")
COSMOS_DATABASE = _env("COSMOS_DATABASE", "hidden-talent")
# Container names (all containers are partitioned on /partition_key)
COSMOS_CONTAINERS = {
    "jobs": _env("COSMOS_JOBS", "jobs"),
    "candidates": _env("COSMOS_CANDIDATES", "candidates"),
    "applications": _env("COSMOS_APPLICATIONS", "applications"),
    "assessments": _env("COSMOS_ASSESSMENTS", "assessments"),
    "llm_cache": _env("COSMOS_LLM_CACHE", "llm_cache"),
}


# Scoring (README section 8)
COVERAGE_WEIGHT = 0.7
SIMILARITY_WEIGHT = 0.3
MUST_WEIGHT = 2.0
NICE_WEIGHT = 1.0
INFERRED_CREDIT = 0.5
DEFAULT_GATE = 0.5
DEFAULT_PASS_THRESHOLD = 0.7
