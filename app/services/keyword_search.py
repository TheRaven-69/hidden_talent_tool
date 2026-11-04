"""Literal keyword search over the small, authoritative Cosmos job catalog.

Both imported and employer-created vacancies follow the same rules. This is
deliberately separate from hybrid retrieval for CV recommendations.
"""
import re
import unicodedata


def tokens(text: str) -> list[str]:
    # Preserve technical names: C++, C#, .NET, Node.js. Unicode includes Swedish.
    normalized = unicodedata.normalize("NFKC", text).casefold()
    return re.findall(r"\.?\w+(?:\.\w+)*(?:\+\+|#)?", normalized)


def search_catalog(documents: list[dict], query: str) -> list[dict]:
    terms = list(dict.fromkeys(tokens(query)))
    if not query.strip():
        return documents
    if not terms:
        return []
    ranked = []
    for doc in documents:
        fields = [
            (tokens(doc.get("title") or ""), 8),
            (tokens(" ".join(s.get("label", "") for s in doc.get("skills", []))), 5),
            (tokens(doc.get("location") or ""), 3),
            (tokens(doc.get("sector") or ""), 2),
            (tokens(doc.get("ad_text") or ""), 1),
        ]
        scores = []
        for term in terms:
            # Whole words, plus prefixes of >= 3 characters for partial job titles.
            # Avoid interpreting C as C++ or SQL as NoSQL.
            scores.append(max((weight * (2 if term in words else 1)
                               for words, weight in fields
                               if term in words or (len(term) >= 3 and any(w.startswith(term) for w in words))),
                              default=0))
        if all(scores):
            ranked.append((sum(scores), doc))
    ranked.sort(key=lambda pair: (-pair[0], (pair[1].get("title") or "").casefold(), pair[1]["id"]))
    return [doc for _, doc in ranked]
