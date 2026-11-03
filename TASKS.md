# Team task list (written for beginners)

You do not need to be a programmer to help. Each task says **what** it is, **why** it matters,
**how** to do it step by step, and **how you know it is done**. Pick one, tell the team you took it,
and tick it off below.

## Words you will see
| Word | Plain meaning |
|---|---|
| **Backend** | The part of the app that runs on a server: it reads the CV, calls the AI and does the maths. Python code in `app/`. |
| **Frontend** | The web pages people click on. Code in `frontend/`. |
| **Prompt** | The written instructions we give the AI model (like a briefing to a new colleague). Files in `app/prompts/`. |
| **LLM / model** | The AI (gpt-5-mini) that reads text and answers. |
| **Taxonomy** | The official list of ~1,200 skills and occupations (JobTech). We turn every CV and job ad into IDs from this list so they can be compared. |
| **Cosmos DB** | The database where we store jobs, candidates, applications and results. |
| **Container (Cosmos)** | A "folder" inside the database (e.g. `jobs`). |
| **Container (Docker)** | A sealed box with the whole app inside, so it runs the same everywhere. |
| **Deploy** | Put the app on the internet so others can open it. |
| **Git / commit / branch** | Git saves versions of our files. A commit is one saved version; a branch is your own copy to work on. |
| **Test** | A small program that checks another part of the code still works. |
| **Terminal** | The black window where you type commands. |

## Before you start (everyone)
1. Read `RUNNING.md` and get the project running on your computer (it has a step-by-step guide).
2. **Never paste passwords, keys or real people's data** into code, chat or the AI. Our app does not need any keys.
3. The "Done when" lines are the only thing that matters. If you are stuck for more than 20 minutes, ask.

Difficulty: 🟢 no coding · 🟡 a little coding or careful copy-paste · 🔴 needs a developer

---

## A. Must happen first (blocks everyone else)

### A1. Create the missing database containers 🟡 - DONE BY ANASTASIIA
- **What:** The database `hidden-talent` only has `candidates` and `matches`. We also need `jobs`, `applications`, `assessments`, `llm_cache`.
- **Why:** Without them the app cannot save anything.
- **How:** Follow the command in `RUNNING.md` section 0 (or Azure portal, Cosmos DB, Data Explorer, New Container). Partition key for all of them: `/partition_key`. You need a higher permission than normal; ask whoever owns the Azure subscription.
- **Done when:** `python -m scripts.smoke_check` shows five lines starting with `OK`.

### A2. Load the sample data 🟡
- **What:** Run the two loader scripts so the database contains the 200 Swedish job ads and the 100 sample candidates, each with their skills found by the AI.
- **Why:** The whole demo is built on this data.
- **How:** First test with 3 records: `python -m scripts.preprocess_jobs <path>\job_ads.json --limit 3` and the same for `preprocess_candidates`. Look at the results (task B1). Only when they look good, run again **without** `--limit` (this takes a while and makes many AI calls; do it once and only after the prompts are good, otherwise you pay for bad results).
- **Done when:** The database holds 200 jobs and 100 candidates, and most have at least 3 skills.

---

## B. Make the AI results good (the heart of the project)

### B1. Check and improve the prompts 🟢/🟡
- **What:** A prompt is plain text in `app/prompts/*.md`. Each file starts with a grey comment explaining its job. There are five: read a job ad, read a CV, choose the right skill from the list, write the test questions, grade the answers.
- **Why:** Prompt quality decides whether the app finds the right skills. This is the biggest lever and you do not need to code, only to write clearly.
- **How:**
  1. Load 3 candidates (task A2). Open a candidate in the Azure portal and read the `skills` field.
  2. Ask: are the skills sensible? Is there an evidence quote for each? Did it wrongly list something the person says they *lack* (for example "never used a ticketing system")?
  3. Edit the matching `.md` file (outside the `<!-- -->` comment) in plain words, e.g. "Do not list tools the person has never used". Rerun the loader on the same 3 candidates and compare.
  4. Do the same for job ads: are the extracted skills what a recruiter would expect?
- **Done when:** For 10 candidates and 10 jobs you checked by hand, at least 8 out of 10 look right.
- **Tip:** Change one thing at a time and write down what you changed.

### B2. Check the "choose the right skill" step 🟡
- **What:** For each skill phrase, the app searches the taxonomy and the AI picks one of 5 results (or "none").
- **Why:** If this goes wrong, a "kitchen assistant" might be matched to the wrong skill and the score becomes meaningless.
- **How:** In a notebook (`notebooks/`) or ask a developer to print: phrase, 5 candidates, chosen one, for 30 examples. Mark each right or wrong. Adjust `pick_concept.md`. Note that the list contains a few odd, very specific skills; "none" should be allowed.
- **Done when:** At least 80 % of 30 examples are right.

### B3. Test with the evaluation cases 🟡
- **What:** The data pack has a file `evaluation/test_cases.json` (10 cases) and `candidate_hints.json`.
- **Why:** These are the "answer key" to know whether the matching works. The hints are only for checking afterwards; they must **never** be fed into the matching itself.
- **How:** Ask the person who has the data pack for those two files and put them in a folder that is not committed (e.g. `data/`). A developer writes a small script that runs each case and prints expected vs. actual.
- **Done when:** We have a table of 10 cases with a pass or fail each, and we know the reasons for the fails.

### B4. Sanity-check the scoring 🟢
- **What:** The match score is 70 % skill coverage + 30 % text similarity. Must-have skills count double; "inferred" skills count half. Default gate 50 %, pass 70 %.
- **Why:** Numbers that look random lose the jury's trust.
- **How:** Pick 5 candidates and one job. Calculate by hand whether the ranking makes sense. If a clearly better candidate ranks lower, note the case and tell a developer. Do not change the weights without telling the team (they come from the README).
- **Done when:** You can explain in two sentences why candidate #1 ranks above #2 for one job.

### B5. Remove personal data before the AI sees it (privacy rule) 🔴
- **What:** The README says names, age, gender, photos and contact details must be removed before scoring. The current code only removes e-mails and phone numbers.
- **Why:** It is a core promise of the project (fair hiring, EU rules on AI in recruitment).
- **How (developer):** Extend `strip_pii` in `app/services/normalize.py` (for example remove the "Name:" line, birth dates, "he/she" gender words if present). Add a test in `tests/test_normalize.py`.
- **Done when:** A test CV with a name, date of birth and phone number comes out of `strip_pii` without them.

### B6. Check the assessment questions 🟢
- **What:** For each candidate above the gate, the app writes 6 questions: 3 multiple choice, 1 about a soft skill, 1 about their CV, 1 about a skill they are missing.
- **Why:** They must be fair, answerable in a few minutes and correct.
- **How:** Generate 3 assessments through the app. Check: is exactly one multiple-choice answer correct? Is the missing-skill question encouraging, not a trap? No question asks about age, family or health. Edit `generate_assessment.md` if not.
- **Done when:** 3 generated assessments pass this checklist. Also try answering badly and well and see that the grade differs.

---

## C. Improve what people see (the web app)

You can open the app at http://localhost:5173 after following `RUNNING.md`. The pages are plain on purpose; this is where it can shine.

### C1. Make it look good 🟡/🔴
- **What:** Right now it is unstyled HTML. Add colours, spacing, a logo, a clear header and a consistent look.
- **Why:** Jury members judge in the first 10 seconds.
- **How (developer):** Add one CSS file (`frontend/src/styles.css`) and import it in `main.tsx`. A beginner can propose a colour palette and a layout drawing first (🟢).
- **Done when:** All 5 pages look consistent and readable on a laptop and a phone.

### C2. Make the skill breakdown easy to understand 🟡
- **What:** The employer page shows per skill: found clearly, found indirectly, or missing. Use colours (green / yellow / red) and show the evidence quote under the skill.
- **Why:** This is our unique selling point: "this person is a hidden talent because of what they have already done".
- **Done when:** A non-technical person can explain why a candidate got a score after 30 seconds of looking.

### C3. Better messages while waiting and when something fails 🟡
- **What:** The AI calls take several seconds. Show "Analysing…" spinners and friendly error messages ("Something went wrong, try again") instead of a blank page.
- **Done when:** Turn off the backend on purpose: the page shows a message, not a white screen.

### C4. Candidate-friendly job list 🟡
- **What:** Show the job's municipality, sector and deadline. Hide jobs whose deadline has passed (many sample ads have). Add a drop-down to choose a sample candidate instead of typing an ID like `candidate-042`.
- **Done when:** A new user can find a job and apply without help.

### C5. Always show that a human decides 🟢
- **What:** The employer page already says "Scores support your decision; the decision is yours." Make sure the same message appears on the candidate side and that nothing is ever shown as "rejected".
- **Why:** It is in the README and is our answer to the EU AI Act question in the pitch.
- **Done when:** You looked at every page and found no wording like "reject" or "fail".

### C6. Language and accessibility 🟡
- **What:** Decide which language the interface uses (English for the jury is safest). Check that text has enough contrast, buttons can be reached with the keyboard, and fields have labels.
- **Done when:** You can complete an application using only the keyboard.

---

## D. Quality and safety

### D1. Fill in the missing automated tests 🔴
- **What:** 5 tests are marked "skip" (in `tests/`). They must run without internet using fake Azure and fake AI answers.
- **Why:** README rule: every function has a test. Also protects us from breaking things at 2 a.m.
- **How (developer):** Remove the `skip` lines and write them; run `python -m pytest -q`.
- **Done when:** `0 skipped`, everything passes.

### D2. Try to break it 🟢
- **What:** Behave like a difficult user: empty CV, a CV in Swedish, a very long CV, special characters, a job with no skills, applying twice, submitting an assessment with blank answers.
- **How:** Write each case and what happened in a shared list. A developer fixes the ones that crash.
- **Done when:** No case ends in a blank page or an unexplained error.

### D3. Check the rules from the README one by one 🟢
- Only allowed Azure services are used. No passwords in the code. Every AI answer is checked against a fixed format. The AI cannot invent skills. Every AI call is logged without CV text. Names/age/gender removed before scoring. A human takes the final decision.
- **How:** Print the "Rules for AI assistants" section of the README. For each rule, find one place in the code (or app) that shows it is met. Ask a developer when unsure.
- **Done when:** Every rule has a tick and a note.

---

## E. Put it on the internet (deployment)

### E1. Build the container 🔴
- **What:** Package the whole app in a Docker container (the `Dockerfile` already exists).
- **How (developer):** Install Docker Desktop, then `docker build -t hidden-talent .` and `docker run -p 8000:8000 --env-file .env hidden-talent`. Note: inside a container your personal `az login` is not available, so test locally with the Python command first; the real login will come from Azure (E2).
- **Done when:** The build finishes without errors and http://localhost:8000 shows the app.

### E2. Deploy to the existing Container App 🔴
- **What:** Run that container in Azure Container Apps, which was prepared for us.
- **Why:** Everyone (jury, colleagues) can use one web address.
- **How (developer, with the Azure owner):**
  1. Ask the team how to get the image into the Container App. The README only allows a fixed list of Azure services and a container registry is not on it, so confirm what is allowed.
  2. Turn on the app's **managed identity** (the app's own Azure login, so no passwords are needed) and give it the same roles as in `RUNNING.md`.
  3. Set the settings (endpoints, deployment names) as environment variables from `.env.example`.
  4. Open the web address and run the smoke test by hand: list jobs, apply, assess.
- **Done when:** A colleague who has not installed anything can open the link and complete one application.

### E3. Check logs 🟡
- **What:** Find where the running app writes its logs in Azure.
- **Why:** When something fails during the demo, logs tell why. Logs contain the AI call name and time, never CV text.
- **Done when:** You can show the log line for one AI call.

---

## F. Presentation and demo

### F1. Prepare one demo story 🟢
- **What:** Pick one employer and one candidate and rehearse a 3-minute story, e.g. a volunteer from a repair group applying for customer-support.
- **How:** Create the job in the UI, apply as the candidate, show the "inferred" skills with their evidence, show the assessment, finish on the employer dashboard.
- **Done when:** Two different people can run it smoothly, twice in a row.

### F2. Backup plan 🟢
- **What:** Record a screen video of the story and save screenshots.
- **Why:** Wi-Fi or Azure can fail on stage.
- **Done when:** The video plays from a USB stick.

### F3. The pitch 🟢
- **What:** Slides covering: the problem, the idea ("hidden talent"), how it works in 3 steps, the human-in-the-loop promise, limitations (candidates could use AI to answer; AI grading of soft skills is approximate; EU rules on AI in recruitment), and what comes next.
- **Done when:** A friend who has never seen the project understands it from the slides alone.

---

## G. Housekeeping

### G1. Save work with Git 🟡
- **What:** Nothing from this session is saved in Git yet (current branch: `feat/add-modules`).
- **How:** In the terminal: `git status`, `git add <files>`, `git commit -m "short description"`, `git push`. Never add `.env` (it is already ignored).
- **Tip:** Agree on who edits which folder (prompts, frontend, backend, tests) to avoid two people changing the same file.

### G2. Keep the docs honest 🟢
- When something changes, update `RUNNING.md` and the README the same day.

