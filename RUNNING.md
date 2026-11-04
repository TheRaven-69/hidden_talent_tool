# Running Hidden Talent Tool locally

Run these commands in Windows PowerShell. FastAPI serves the API on port 8000.
Vite serves the React frontend on port 5173 and proxies `/api` to FastAPI.
The application uses the team's Azure services.

## 1. Set up your environment

Install Python 3.12+, Node.js and Azure CLI. From the repository root, sign in
with the team's Azure account:

```powershell
az login
```

If the team provided a tenant and subscription, use
`az login --tenant "<tenant-id>"` and `az account set --subscription "<subscription-id>"`.
If PowerShell cannot find `az` after installation, reopen the terminal.

Create configuration only if `.env` does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Fill in real endpoints in your local `.env`. Do not overwrite a working `.env`.
The example contains placeholders, not resource addresses or credentials.

Required settings:

| Variable | Value |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Foundry Azure OpenAI endpoint |
| `CHAT_DEPLOYMENT` | Deployment name, `chat` in the supplied lab |
| `EMBEDDING_DEPLOYMENT` | Deployment name, `embedding` in the supplied lab |
| `SEARCH_ENDPOINT` | Existing Azure AI Search endpoint |
| `COSMOS_ENDPOINT` | Existing Cosmos DB endpoint |
| `COSMOS_DATABASE` | `hidden-talent` in the supplied lab |

The configured embedding deployment must match the model used to build the indexes:
`text-embedding-3-small`, 1536 dimensions in the supplied environment. Both vector
fields are named `vector`. Taxonomy uses `id`, `preferred_label`, `definition` and a
filterable `type` field; the default filter is `type eq 'skill'`.

Your Azure account needs model inference access (Cognitive Services OpenAI User),
Search Index Data Reader and Cosmos DB **native data-plane** access (Cosmos DB
Built-in Data Contributor). Generic RG Contributor alone is not sufficient.
Existing Cosmos containers are `jobs`, `candidates`, `applications`, `assessments`,
`llm_cache`, partitioned on `/partition_key`. Optional `COSMOS_JOBS`,
`COSMOS_CANDIDATES`, `COSMOS_APPLICATIONS`, `COSMOS_ASSESSMENTS`, `COSMOS_LLM_CACHE`
variables override names. For example, use `COSMOS_APPLICATIONS=matches` only if the
team has intentionally chosen that container. Startup never provisions resources.

## 2. Start FastAPI and Vite

In the first terminal, from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

In a second terminal, also from the repository root:

```powershell
cd frontend
npm install
npm run dev -- --strictPort
```

Open [the app](http://localhost:5173) or [the API docs](http://localhost:8000/docs).
On subsequent runs, start Uvicorn and Vite directly if dependencies are installed.
Press Ctrl+C in each terminal to stop its server.

## 3. Checks and starter data

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
.\.venv\Scripts\python.exe -m scripts.smoke_check
```

The test suite runs offline. Expect 29 passes and 5 skipped TODO tests.
The Azure smoke check reads data and makes small billable model calls.
Expect five OK lines for chat, embeddings, taxonomy search, jobs search and Cosmos.
If credentials fail, check `az account show` in the same terminal that runs FastAPI.
For a 403, check the service data roles listed above.

The starter jobs are already synchronized in the team's environment. To check a
different environment, preview the import and apply it only if jobs are missing:

```powershell
.\.venv\Scripts\python.exe -m scripts.sync_jobs
.\.venv\Scripts\python.exe -m scripts.sync_jobs --apply
```

Sync inserts missing Search IDs in Cosmos and preserves existing jobs. Add
`--metadata "C:/path/to/job_ads.json"` to include dates for newly inserted jobs.
The older preprocessing scripts can overwrite records and make model calls.
Reserve them for intentional reprocessing.

## 4. Current UI and behavior

- **All jobs:** search, sector/location/deadline filters, descriptions, available
  skills and pagination. Numeric recruiter gates and skill weights are hidden in
  candidate views. Jobs without a deadline show no deadline label.
- **Find matching jobs:** select a fictional candidate or paste fictional text.
  The backend retrieves five starter jobs using taxonomy skill labels and includes
  employer-created Cosmos jobs. It scores them using the 70/30 coverage/similarity
  formula and returns up to three with nonzero skill coverage. This is not an
  exhaustive ranking of the entire catalog.
- **Review & apply:** shows the vacancy, requirements and next steps. The profile
  from recommendations is retained. Submission saves an application; assessment is
  available only when its score meets the employer gate. Below-gate applications
  remain available for employer review. Assessment starts when the candidate chooses.
- **Employer / Create job:** public description, AI skill suggestions, importance,
  review confirmation, entry gate and assessment target. The optional internal
  assessment brief guides question generation and open-answer rubrics. It is omitted
  from candidate catalog/detail/recommendation responses. The assessment target is
  stored but is not yet applied to results or decisions.
- Publishing navigates to the employer candidate dashboard. That page shows scores
  and skill breakdowns. No login, notifications or automatic rejection is implemented.
- Candidate assessment API responses omit correct answers and internal rubrics.
  Full assessment data remains in Cosmos for grading and employer review.

Use synthetic profiles only. Existing ads retain original languages; taxonomy names
are Swedish. First analysis can take several minutes. One measured run took ~334
seconds; a repeat took 5.6 seconds, not a performance guarantee.

Known quality limitation: CSV duplicate checking was incorrectly mapped to SQL-Base
for `candidate-051`. Scores remain experimental. Changing prompts invalidates the
LLM cache key, but does not refresh already stored skills: explicit reprocessing is
needed, including the `skills_normalized` flag for successfully empty results.
Critical qualifications/licence gating is not implemented yet. Starter vacancies
are a frozen snapshot and can be expired. Drafts and application receipts in the UI
are not persisted across page reloads, although submitted applications stay in Cosmos.

## 5. Production image for Azure Container Apps

```powershell
docker build --target production -t hidden-talent .
```

The default final Dockerfile stage is also `production`. It serves built React and
FastAPI in one container on port 8000 and omits Azure CLI/test tooling. Configure the
existing endpoints and deployment names as Container App environment variables.
Attach the supplied user-assigned managed identity and set `AZURE_CLIENT_ID` to its
client ID, with the service data roles already assigned. Image publishing/deployment is a separate team step;
these commands do not provision or deploy any Azure resources.
