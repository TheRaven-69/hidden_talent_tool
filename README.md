# Hidden Talent Tool Hackathon

An AI-powered tool that helps employers find the right candidate by extracting and translating competencies from CVs and job ads, matching them through a shared skills taxonomy, and verifying them with a tailored AI assessment

> **This file is both the team's project guide and the master prompt for AI coding assistants.**
> When using an AI assistant (Claude Code, Copilot, Cursor, etc.), give it this file first. Section 11 contains rules the assistant must follow.

For the current setup and supported flows, see [RUNNING.md](RUNNING.md). The recommended
local run uses Docker Compose on port 8080; host Python/Vite remains an optional
hot-reload workflow. The local image includes Azure CLI for developer sign-in, while
the default production image uses managed identity without CLI/test tooling.

---

## 1. Problem and goal

Good candidates are often missed because their CVs describe skills in different words, in another language, or through experience from another field. Keyword matching filters them out.

**Goal:** match employers with the right talent, including candidates whose skills are "hidden" in their CV, and give employers an explainable, per-skill view of each candidate.

**Event constraints:** 1.5 days, 5 people, Python backend with a React frontend, and only the Azure resources listed in section 3.

---

## 2. User flow

1. **Employer creates a job ad**, selects the most important skills (must-have / nice-to-have), sets an assessment gate and a pass threshold, and publishes it.
2. **Candidate finds the job and applies** with a CV.
3. **The CV is matched** against the job's skills. If the match score is above the employer's gate, the candidate is invited to a **tailored assessment**: hard and soft skills chosen by the employer, questions based on the candidate's CV, and questions probing skills the CV doesn't show.
4. **Employer sees the results**: match score, assessment score, and a per-skill breakdown with evidence. **A human makes the decision** (invite or reject).

---

## 3. Resources (use only these)

| Resource | Purpose |
|---|---|
| **Azure AI Foundry** | Chat model (extraction, question generation, grading) and embedding model |
| **Azure AI Search** | Existing indexes: `taxonomy` (skill normalizer) and `jobs` (candidate job search) |
| **Azure Cosmos DB** | Jobs, candidates, applications, assessments, cached LLM results |
| **Azure Storage** | Uploaded CV files |
| **Azure Container Apps** | Hosts the app (one container: FastAPI + built React) |
| **Identity** | Managed identity / role-based access, no hard-coded keys in code |
| **Logs** | Application and LLM-call logging |

**Mock data provided:** 200 Swedish job ads, 1,248 JobTech taxonomy concepts, 100 fictional English candidate profiles.

**Do not add other services or paid resources.**

---

## 4. Core idea: taxonomy as the common language

Job ads (Swedish) and CVs (English) describe the same skills in different words. Both are translated into the same fixed vocabulary: **JobTech taxonomy concept IDs**. Matching then compares lists of concept IDs, which is precise and explainable.

**Skill normalization pipeline** (used for both jobs and CVs):

1. **Extract:** the LLM pulls skill phrases from the text (structured JSON output).
2. **Search:** each phrase is queried against the `taxonomy` index in AI Search, returning the top 5 candidate concepts.
3. **Pick:** the LLM chooses the correct concept from those 5, or `none`. It never invents concepts.
4. **Store:** the concept ID, label, and (for candidates) evidence quote and confidence flag.

**Confidence flags for candidate skills:**
- `explicit`: the skill is stated in the CV.
- `inferred`: a transferable skill implied by the CV (e.g. "managed the Kyiv office" → people management). This is the "hidden talent." Inferred skills must always be labeled as inferred and backed by an evidence quote.

---

## 5. Before coding: verify the existing indexes

Check these in the Azure portal (AI Search → Indexes → Fields / Vector profiles / Search explorer) and fill in the table:

| Question | `taxonomy` | `jobs` |
|---|---|---|
| Field names (id, label, description, type) | TBD | TBD |
| Vector field name and dimensions | TBD | TBD |
| Vectorizer configured? Which embedding model? | TBD | TBD |
| Concept types (skills only, or mixed?) | TBD | n/a |
| Label languages (sv / en) | TBD | TBD |

**Rules:**
- Queries must use the **same embedding model** that built the index.
- If the taxonomy mixes concept types, filter to skill-type concepts.
- If there are no vector fields, use keyword search as a fallback and raise it with the team.

---

## 6. Architecture

```
React UI (employer + candidate views, built to static files)
        │  HTTP/JSON
FastAPI backend ──> Foundry (chat + embeddings)
        │       ──> AI Search (taxonomy, jobs)
        │       ──> Cosmos DB (all app data + LLM cache)
        │       ──> Storage (CV files)
        │
One container in Container Apps: FastAPI serves the API and the built
React files, managed identity, logs
```

**Frontend deployment:** the React app is built (`npm run build`) in a multi-stage Dockerfile, and FastAPI serves the static files. This keeps everything in one container on the existing Container App, with no extra hosting resource and no CORS setup in production. During local development, run the React dev server (Vite) with a proxy to FastAPI.

---

## 7. Data model (Cosmos DB containers)

**jobs**
```json
{
  "id": "job-001",
  "title": "Backend Developer",
  "location": "Stockholm",
  "ad_text": "...",
  "skills": [
    {"concept_id": "abc123", "label": "Python", "weight": "must"},
    {"concept_id": "def456", "label": "Systemarkitektur", "weight": "nice"}
  ],
  "gate": 0.5,
  "pass_threshold": 0.7
}
```

**candidates**
```json
{
  "id": "cand-042",
  "cv_text": "...",
  "cv_blob_path": "cvs/cand-042.pdf",
  "skills": [
    {"concept_id": "abc123", "label": "Python", "confidence": "explicit",
     "evidence": "Built Django APIs serving..."},
    {"concept_id": "ghi789", "label": "Personalledning", "confidence": "inferred",
     "evidence": "Country Manager for the Kyiv office"}
  ]
}
```

**applications**
```json
{
  "id": "app-001",
  "job_id": "job-001",
  "candidate_id": "cand-042",
  "match_score": 0.68,
  "skill_breakdown": [
    {"concept_id": "abc123", "status": "explicit", "evidence": "..."},
    {"concept_id": "def456", "status": "missing"}
  ],
  "status": "assessment_invited"
}
```

**assessments**
```json
{
  "id": "asm-001",
  "application_id": "app-001",
  "questions": [
    {"id": "q1", "type": "hard_skill", "concept_id": "abc123",
     "format": "multiple_choice", "text": "...", "options": ["..."],
     "correct": "B", "answer": "B", "score": 1.0},
    {"id": "q2", "type": "soft_skill", "format": "open",
     "text": "...", "rubric": "...", "answer": "...",
     "score": 0.75, "reasoning": "..."}
  ],
  "total_score": 0.78,
  "per_skill": {"abc123": 1.0, "def456": 0.6}
}
```

Field names are a starting point. Agree on final schemas in the first hour and don't change them without telling the team.

---

## 8. Scoring

**Match score** (CV vs. job), shown as a per-skill breakdown, not just a total:
- Skill coverage: for each required skill, `explicit` = 1.0, `inferred` = 0.5, `missing` = 0. Must-have skills weigh more than nice-to-have (e.g. 2 : 1).
- Semantic similarity: CV embedding vs. job ad embedding.
- `match_score = 0.7 × coverage + 0.3 × similarity` (tune if needed).

**Assessment gate:** set by the employer (suggested default 50%). The CV match decides *what to ask* as much as *whether to ask*.

**Assessment score:**
- Hard-skill questions: auto-graded (multiple choice or short answers with a clear key).
- Soft-skill and open questions: graded by the LLM against a rubric written when the question is generated. Store the reasoning.
- Report both a total and a per-skill score.

**Pass threshold:** set by the employer (suggested default 70%). The tool never rejects anyone automatically.

---

## 9. Assessment design

6–8 questions per application:
- **Hard skills** (employer-selected): 2–3, auto-graded.
- **Soft skills** (employer-selected): 1–2 situational judgment questions, rubric-graded.
- **CV-based**: 1–2 questions verifying claimed experience.
- **Gap probes**: 1–2 questions on must-have skills the CV doesn't show (where hidden talent can surface).

---

## 10. API endpoints (FastAPI)

| Method | Path | Purpose |
|---|---|---|
| POST | `/jobs/suggest-skills` | Ad text → suggested taxonomy skills |
| POST | `/jobs` | Save a confirmed job |
| GET | `/jobs` | List / search jobs |
| POST | `/applications` | Candidate applies (CV upload or mock profile) → match score |
| POST | `/assessments/{application_id}` | Generate the assessment |
| POST | `/assessments/{id}/submit` | Submit answers → grading |
| GET | `/jobs/{job_id}/candidates` | Employer dashboard: ranked candidates with breakdown |

---

## 11. Rules for AI coding assistants

When generating code for this project:

1. **Use only the resources in section 3.** Do not introduce new Azure services, external APIs, or paid tools.
2. **Stack:** Python with FastAPI for the backend; React with TypeScript (Vite) for the frontend. Keep the frontend simple: plain components, `fetch` for API calls, one lightweight UI library at most. All AI, search and data logic stays in the backend; the frontend never calls Azure services directly.
3. **Authentication:** use `DefaultAzureCredential` (managed identity). Never hard-code keys or secrets; read configuration from environment variables.
4. **Structured outputs:** every LLM call returns JSON validated against a schema (Pydantic models).
5. **Never invent taxonomy concepts.** The LLM may only choose from concepts returned by AI Search, or `none`.
6. **Label inferred skills** as `inferred` and always attach an evidence quote from the CV.
7. **Cache LLM results** in Cosmos DB keyed by input hash, so the demo runs fast and repeatable.
8. **Log every LLM call** (purpose, latency, success/failure). Do not log full CV text or personal data.
9. **Privacy and fairness:** strip names, age, gender, photos, and contact details before any scoring or grading. The tool supports human decisions and never auto-rejects.
10. **Keep it simple:** hackathon code, readable over clever. No auth/login, notifications, or multi-tenant features.
11. **Follow the schemas in section 7.** If a change is needed, say so explicitly.
12. **Tests:** add or update a test in `tests/` for every service function you write (see section 13). Mock Azure clients and LLM calls; tests must run without network access.

---

## 12. Repository structure

```
hidden-talent-tool/
├── README.md
├── .gitignore
├── .env.example            # endpoints and deployment names, no secrets
├── requirements.txt
├── Dockerfile              # multi-stage: build React, then Python image
├── app/                    # FastAPI backend
│   ├── main.py             # app entry; mounts API routes + serves frontend build
│   ├── api/                # FastAPI routes
│   ├── services/
│   │   ├── llm.py          # Foundry client, structured outputs, caching
│   │   ├── search.py       # AI Search queries (taxonomy, jobs)
│   │   ├── normalize.py    # extract → search → pick pipeline
│   │   ├── matching.py     # match score
│   │   ├── assessment.py   # question generation + grading
│   │   └── storage.py      # Cosmos DB + Blob Storage
│   └── models/             # Pydantic schemas
├── frontend/               # React + TypeScript (Vite)
│   ├── package.json
│   ├── vite.config.ts      # dev proxy: /api → FastAPI
│   └── src/
│       ├── api/            # typed fetch helpers for the endpoints in section 10
│       ├── pages/
│       │   ├── employer/   # create job, candidate dashboard
│       │   └── candidate/  # job list, apply, assessment
│       └── components/     # skill breakdown, score display, forms
├── tests/                  # backend unit tests (pytest), see section 13
├── scripts/
│   ├── preprocess_jobs.py
│   └── preprocess_candidates.py
└── notebooks/              # prompt experiments
```

---

## 13. Unit tests

Backend tests use **pytest** and live in `tests/`. They must run offline: mock all Azure clients (Foundry, AI Search, Cosmos DB, Storage) and LLM responses.

```
tests/
├── conftest.py              # shared fixtures: sample job, candidate, mocked clients
├── test_normalize.py        # TODO: extract → search → pick; "none" when no concept fits
├── test_matching.py         # TODO: coverage weights (explicit/inferred/missing, must/nice), score range 0–1
├── test_assessment.py       # TODO: question mix per section 9; grading of MC and rubric answers
├── test_storage.py          # TODO: Cosmos/Blob read-write with mocked clients
└── test_api.py              # TODO: endpoint smoke tests with FastAPI TestClient
```

Placeholder to start from:

```python
# tests/test_matching.py
import pytest

@pytest.mark.skip(reason="TODO: implement once matching.py exists")
def test_explicit_must_have_counts_fully():
    ...

@pytest.mark.skip(reason="TODO")
def test_inferred_skill_counts_half():
    ...

@pytest.mark.skip(reason="TODO")
def test_match_score_between_0_and_1():
    ...
```

Run with `pytest` from the repository root. Frontend tests are out of scope for the hackathon.

---

## 14. Catalog and recommendations implementation additions

- Jobs optionally store `assessment_brief` (up to 6,000 characters) as internal
  employer guidance, separate from public `ad_text`. Existing jobs default to an
  empty brief. Generation uses it to focus questions and write open-answer rubrics;
  grading then uses those stored rubrics. It does not affect CV matching or gates.
  Candidate job list/detail and recommendation responses omit the brief. Candidate
  assessment responses omit `correct` and `rubric`; full data remains stored for
  grading and the employer dashboard. This demo still has no login/access control.

- `python -m scripts.sync_jobs` previews importing missing Search jobs into Cosmos;
  `--apply` inserts them without replacing existing jobs. Optional `--metadata`
  accepts the starter jobs JSON for dates. No Search index writes are required.
- Imported jobs add `source: "search"`, `sector`, `source_url`, optional dates and
  `skills_normalized`. Candidate documents can also carry `skills_normalized`.
  Existing metadata and candidate partition keys are preserved during normalization.
- `GET /api/candidates` returns fictional profile choices; `POST /api/recommendations`
  accepts exactly one of `candidate_id` or non-empty `cv_text`.
- Recommendations use taxonomy labels for hybrid retrieval (five starter jobs),
  include employer-created Cosmos jobs, then use the existing 70/30 match formula.
  Return up to three jobs with nonzero skill coverage, per-skill evidence and
  `meets_score_gate`. This flag is only the current numerical gate, not verified
  qualifications or the planned critical-requirement feature.
- Applying resolves a missing Cosmos job from Search and lazily normalizes it.
  The recommendation itself never creates an application or assessment.
- `GET /api/jobs/{job_id}` reads vacancy details from Cosmos or falls back to
  Search without normalization or writes. The application page shows the original
  description, available skill requirements, the score gate and next steps before
  submission. A successful submission shows evidence and either the assessment
  invitation or confirmation that the below-gate application remains for review.


## 15. Out of scope

Login and authentication, notifications, multiple employers, complex PDF parsing (plain text extraction is enough), assessment editing, proctoring, frontend tests.

**Known limitations to mention in the pitch:** candidates could use AI to answer open questions; LLM grading of soft skills is approximate (mitigated with rubrics and visible reasoning); the EU AI Act classifies AI for recruitment as high-risk, which is why the tool keeps a human in the loop, explains scores, and logs decisions.
