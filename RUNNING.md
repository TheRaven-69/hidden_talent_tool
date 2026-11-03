# Running the project locally

Commands are for Windows PowerShell, run from the repository root.

## 0. Prerequisites
- Python 3.12+, Node 20+, Azure CLI (`az`)
- Your Azure user needs these roles (see "Secrets" in the README rules: no keys are used):
  - Foundry: **Cognitive Services OpenAI User**
  - AI Search: **Search Index Data Reader** (Contributor only if you load the indexes)
  - Cosmos DB: the data-plane role **Cosmos DB Built-in Data Contributor**
    (`az cosmosdb sql role assignment create ...`, it is not a normal Azure RBAC role)
- Cosmos DB containers must exist in the database, all with partition key `/partition_key`:
  `jobs`, `candidates`, `applications`, `assessments`, `llm_cache`. Creating containers needs a
  management-plane role (for example Contributor on the Cosmos account), not the data role:
  ```powershell
  foreach ($c in "jobs","applications","assessments","llm_cache") {
    az cosmosdb sql container create --account-name <cosmos-account> --resource-group <rg> `
      --database-name hidden-talent --name $c --partition-key-path /partition_key
  }
  ```
  (`candidates` already exists. If the existing `matches` container is meant to hold applications,
  skip creating `applications` and set `COSMOS_APPLICATIONS=matches` in `.env` instead.)

## 1. Sign in to Azure
```powershell
az login
az account set --subscription "<your subscription>"
```

## 2. Python environment
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```

## 3. Configure
```powershell
Copy-Item .env.example .env
```
Open `.env` and fill in `AZURE_OPENAI_ENDPOINT`, `SEARCH_ENDPOINT` and `COSMOS_ENDPOINT`.
Check the deployment names and the index field names against the portal.
`.env` is gitignored and contains no secrets.

## 4. Check everything works

**a) Offline tests** (no Azure needed, should pass in a second):
```powershell
python -m pytest -q
```
Expected: `16 passed, 5 skipped`.

**b) Azure connectivity:**
```powershell
python -m scripts.smoke_check
```
Expected: five `OK` lines (chat, embeddings, taxonomy search, jobs search, Cosmos).
If a line says `FAIL`:
- `AuthorizationFailed`/`403`/`PermissionDenied`: missing role (step 0), or wait a few minutes after assigning it.
- Taxonomy search error mentioning a field or filter: fix `TAXONOMY_*` in `.env`, and check that `type`
  is filterable in the index (or set `TAXONOMY_FILTER=` to disable the filter).
- Embeddings or empty search results: the deployment must be the same embedding model that built the index.

## 5. Load a few mock records (cheap trial)
```powershell
python -m scripts.preprocess_jobs path\to\job_ads.json --limit 3
python -m scripts.preprocess_candidates path\to\candidates.json --limit 3
```
Each line prints `saved <id> <n> skills`. Open a document in Cosmos Data Explorer and read its skills:
- candidate skills should have an evidence quote and should **not** include things the person says they lack
  (for example "never used a ticketing system");
- most job skills should be real, sensible taxonomy skills.

If `n` is 0 for everything, the taxonomy search is returning nothing useful. Fix that before loading all 300.
Then run again without `--limit` (it makes thousands of model calls; results are cached, so reruns are cheap).

## 6. Start the backend
```powershell
uvicorn app.main:app --reload
```
Open http://localhost:8000/docs and try, in order:
1. `GET /api/jobs` returns the loaded jobs.
2. `POST /api/applications` with `{"job_id": "jobtech-31244028", "candidate_id": "candidate-001"}`
   returns a `match_score` and a `skill_breakdown`.
3. `POST /api/assessments/{application_id}` returns the questions
   (403 if the score is below the job's gate; that is intended).

## 7. Start the frontend (second terminal)
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 (it proxies `/api` to port 8000). Walk through:
create a job from an ad text, then apply as a candidate, then do the assessment, then view the employer dashboard.

## 8. Production-style run (one container)
```powershell
docker build -t hidden-talent .
```
In Azure the container uses its managed identity and the same environment variables.
