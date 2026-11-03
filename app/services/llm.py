"""Foundry client: structured outputs (Pydantic), embeddings, caching, logging.

Calls the model directly from Python (no agent layer): every step is a
single-shot, schema-validated call, which keeps it cacheable and testable.
"""
import hashlib
import logging
import time
from functools import lru_cache
from typing import Type, TypeVar

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI
from pydantic import BaseModel

from app import config
from app.services import storage

log = logging.getLogger("llm")
T = TypeVar("T", bound=BaseModel)


@lru_cache
def _client() -> AzureOpenAI:
    token = get_bearer_token_provider(
        DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
    )
    return AzureOpenAI(
        azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
        api_version=config.AZURE_OPENAI_API_VERSION,
        azure_ad_token_provider=token,
    )


def _hash(*parts: str) -> str:
    return hashlib.sha256("\x1f".join(parts).encode()).hexdigest()


def chat_json(purpose: str, system: str, user: str, schema: Type[T], use_cache: bool = True) -> T:
    """One chat call returning a validated `schema` instance. Cached by input hash."""
    key = _hash(config.CHAT_DEPLOYMENT, purpose, system, user, schema.__name__)
    if use_cache:
        hit = storage.cache_get(key)
        if hit:
            log.info("llm purpose=%s cache=hit", purpose)
            return schema.model_validate(hit["value"])

    start = time.perf_counter()
    try:
        resp = _client().beta.chat.completions.parse(
            model=config.CHAT_DEPLOYMENT,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format=schema,
        )
        result = resp.choices[0].message.parsed
        if result is None:
            raise ValueError("Model returned no parsable output")
    except Exception:
        log.exception("llm purpose=%s ok=False latency=%.2fs", purpose, time.perf_counter() - start)
        raise
    # Never log prompt/response bodies: they may contain personal data.
    log.info("llm purpose=%s ok=True latency=%.2fs", purpose, time.perf_counter() - start)
    if use_cache:
        storage.cache_put(key, result.model_dump())
    return result


def embed(texts: list[str]) -> list[list[float]]:
    start = time.perf_counter()
    resp = _client().embeddings.create(model=config.EMBEDDING_DEPLOYMENT, input=texts)
    log.info("embed n=%d latency=%.2fs", len(texts), time.perf_counter() - start)
    return [d.embedding for d in resp.data]
