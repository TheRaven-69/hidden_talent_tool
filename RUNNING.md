# Running Hidden Talent Tool

Run commands in Windows PowerShell from the repository root. The recommended local
setup is Docker Compose: one container serves the existing built React frontend and
FastAPI API. The UI is unchanged; no separate Vite or Python process is required.
Azure Search, Foundry and Cosmos remain the existing cloud services, not local emulators.

## 1. Prerequisites and configuration

- Docker Desktop running in **Linux containers** mode, with Docker Compose.
- Access to the team's existing Azure resources and a developer account that can sign in.
- No host Python, Node or Azure CLI installation is required for the Compose path.

Check Docker:

```powershell
docker version
docker compose version
```

`docker version` must show both Client and Server. A missing
`dockerDesktopLinuxEngine` pipe means Docker Desktop's Linux engine is not running.

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

## 2. Build and sign in inside the local container

```powershell
docker compose build
docker compose run --rm app az login --use-device-code
```

Follow the URL and code printed by Azure CLI and sign in yourself with the team's
account. If tenant selection is required:

```powershell
docker compose run --rm app az login --tenant <tenant-id> --use-device-code
docker compose run --rm app az account set --subscription <subscription-id>
```

The `local` build target includes Azure CLI in its own Python environment.
`DefaultAzureCredential` uses that CLI login. Credentials are retained in the
`azure-login` Docker volume, not in the image or repository. Host Windows CLI login
is separate; do not mount the Windows `.azure` directory into this Linux container.
If device-code sign-in is blocked by tenant policy, consult the lab coach; the host
Python/Vite workflow in section 7 remains available.

## 3. Start, inspect and stop

```powershell
docker compose up -d
docker compose ps
docker compose logs --tail 100 app
```

Open the app at **http://localhost:8080** and API docs at
**http://localhost:8080/docs**. The healthcheck only confirms the web app responds;
it does not verify Azure connectivity.

After code changes, rebuild (there are no source bind mounts or hot reload):

```powershell
docker compose up -d --build
```

The old local servers on ports 5173/8000 can be stopped when you switch to 8080.
If 8080 is occupied, set `APP_PORT=8081` in `.env` and recreate the container.

```powershell
docker compose logs -f app
docker compose down
```

`down` retains the Azure login volume. To sign out:

```powershell
docker compose run --rm app az logout
```

## 4. Checks

Offline tests (Azure and LLM calls mocked):

```powershell
docker compose run --rm app python -m pytest -q -p no:cacheprovider
```

Current expected result: **29 passed, 5 skipped**. Five original TODO tests remain.
The local image includes test dependencies; the production image does not.

Azure smoke check (reads data and makes small billable chat/embedding calls; no writes):

```powershell
docker compose run --rm app python -m scripts.smoke_check
```

Expect five `OK` lines: chat, embeddings, taxonomy search, jobs search, Cosmos.
- Login errors: repeat the container login, checking tenant and subscription.
- 403: verify service data roles; allow time for newly assigned roles to propagate.
- Unknown field/filter: compare `.env` names with actual Search schema.
- Wrong vector dimension: verify the embedding deployment and index model agree.
- Missing Cosmos container: consult the team; do not recreate the environment blindly.

## 5. Starter catalog and optional data preparation

Search contains 200 starter jobs. Each application needs a Cosmos job with the same
ID. Our initial sync added these jobs while preserving employer-created jobs; reruns
only insert missing IDs and never replace existing documents.

Preview, then explicitly apply if necessary:

```powershell
docker compose run --rm app python -m scripts.sync_jobs
docker compose run --rm app python -m scripts.sync_jobs --apply
```

Optional date metadata is in `job_ads.json`, not in Search. To use a host dataset,
mount its directory read-only (replace the example with your actual absolute path):

```powershell
docker compose run --rm -v "C:/path/to/datasets:/data:ro" app python -m scripts.sync_jobs --metadata /data/job_ads.json
docker compose run --rm -v "C:/path/to/datasets:/data:ro" app python -m scripts.sync_jobs --apply --metadata /data/job_ads.json
```

Metadata is applied only to newly inserted documents. The sync makes no model calls
and never writes to Search. Job skills are normalized on first use and retained.
Starter candidates already exist in Cosmos; reimporting all profiles is unnecessary.

The older `scripts.preprocess_jobs` and `scripts.preprocess_candidates` commands
still exist. They **upsert** and can replace existing records. Use them only for
intentional preprocessing, first with `--limit 3`; they make billable model calls.
Do not run a full reload as a routine startup step.

## 6. Current UI and behavior

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

## 7. Optional host development with hot reload

Use this when actively changing code or when container sign-in is unavailable.
Prerequisites: Python 3.12+, Node 20+, Azure CLI on PATH and `.env` configured.

```powershell
az login
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m pytest -q
uvicorn app.main:app --reload
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173; Vite proxies `/api` to port 8000. This login is independent
from the container login. If Vite shows old modules after file changes, restart its
process. Container rebuilds avoid dependence on filesystem watchers.

## 8. Production image for Azure Container Apps

```powershell
docker build --target production -t hidden-talent .
```

The default final Dockerfile stage is also `production`. It serves built React and
FastAPI in one container on port 8000 and omits Azure CLI/test tooling. Configure the
existing endpoints and deployment names as Container App environment variables.
Attach the supplied user-assigned managed identity and set `AZURE_CLIENT_ID` to its
client ID, with the service data roles already assigned. Do not mount the local
Azure login volume in Azure. Image publishing/deployment is a separate team step;
these commands do not provision or deploy any Azure resources.
