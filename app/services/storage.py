"""Cosmos DB: app data and LLM cache."""
from functools import lru_cache
from typing import Any, Optional

from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosResourceExistsError
from azure.identity import DefaultAzureCredential

from app import config

CONTAINERS = list(config.COSMOS_CONTAINERS)  # logical names


def _partition_key(container: str) -> str:
    """Containers are partitioned on /partition_key; every document must carry it."""
    return container


@lru_cache
def _cosmos_db():
    client = CosmosClient(config.COSMOS_ENDPOINT, credential=DefaultAzureCredential())
    return client.get_database_client(config.COSMOS_DATABASE)


def _container(name: str):
    return _cosmos_db().get_container_client(config.COSMOS_CONTAINERS[name])


def upsert(container: str, item: dict) -> dict:
    if not item.get("partition_key"):
        item["partition_key"] = _partition_key(container)
    return _container(container).upsert_item(item)


def create_if_absent(container: str, item: dict) -> bool:
    """Insert only; never overwrite an employer's existing document."""
    document = {**item, "partition_key": item.get("partition_key") or _partition_key(container)}
    try:
        _container(container).create_item(document)
        return True
    except CosmosResourceExistsError:
        return False


def get(container: str, item_id: str) -> Optional[dict]:
    items = query(container, "SELECT * FROM c WHERE c.id = @id", [{"name": "@id", "value": item_id}])
    return items[0] if items else None


def query(container: str, sql: str, params: Optional[list[dict[str, Any]]] = None) -> list[dict]:
    return list(
        _container(container).query_items(
            query=sql, parameters=params or [], enable_cross_partition_query=True
        )
    )


def list_all(container: str) -> list[dict]:
    return query(container, "SELECT * FROM c")


# ----- LLM cache (keyed by input hash) -----
def cache_get(key: str) -> Optional[dict]:
    return get("llm_cache", key)


def cache_put(key: str, value: dict) -> None:
    upsert("llm_cache", {"id": key, "value": value})

