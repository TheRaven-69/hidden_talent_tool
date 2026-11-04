from unittest.mock import Mock

from fastapi.testclient import TestClient

from app.main import app
from app.services import llm, storage
from app.services.keyword_search import search_catalog


def job(key, title, **fields):
    return {"id": key, "title": title, "ad_text": "", **fields}


def test_exact_title_ranks_before_skill_and_description():
    docs = [job("description", "Analyst", ad_text="Python for analysis"),
            job("skill", "Engineer", skills=[{"label": "Python"}]),
            job("title", "Python developer")]
    assert [d["id"] for d in search_catalog(docs, "PYTHON")] == ["title", "skill", "description"]
    assert search_catalog(docs, "zzzxqvnotaskill") == []


def test_all_terms_and_locations_and_partial_swedish_titles():
    docs = [job("one", "Truck driver", location="Stockholm"), job("two", "Truck mechanic"),
            job("three", "Systemutvecklare", location="Göteborg")]
    assert [d["id"] for d in search_catalog(docs, "truck driver")] == ["one"]
    assert [d["id"] for d in search_catalog(docs, "truck Stockholm")] == ["one"]
    assert [d["id"] for d in search_catalog(docs, "systemutveck göteborg")] == ["three"]


def test_technical_tokens_not_arbitrary_substrings():
    docs = [job("cpp", "C++ developer"), job("csharp", "C# developer"),
            job("net", ".NET developer"), job("sql", "SQL developer"), job("nosql", "NoSQL developer")]
    for query, expected in [("C++", "cpp"), ("C#", "csharp"), (".NET", "net"), ("SQL", "sql")]:
        assert [d["id"] for d in search_catalog(docs, query)] == [expected]
    assert search_catalog(docs, "C") == []
    assert search_catalog(docs, "+++") == []
    assert search_catalog(docs, "  ") == docs


def test_endpoint_searches_all_sources_without_embeddings_or_twenty_hit_cap(monkeypatch):
    docs = [job(str(i), "Python developer", source="search", assessment_brief="private") for i in range(25)]
    docs.append(job("local", "Python developer", assessment_brief="private"))
    monkeypatch.setattr(storage, "list_all", lambda _: docs)
    embed = Mock(side_effect=AssertionError("Keyword searches must not call embeddings"))
    monkeypatch.setattr(llm, "embed", embed)
    response = TestClient(app).get("/api/jobs", params={"q": "Python"})
    assert response.status_code == 200
    assert len(response.json()) == 26
    assert any(d["id"] == "local" for d in response.json())
    assert all("assessment_brief" not in d for d in response.json())
    embed.assert_not_called()
