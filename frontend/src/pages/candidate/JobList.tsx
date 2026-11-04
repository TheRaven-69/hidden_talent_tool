import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, Job } from "../../api/client";
import "./job-list.css";

const PAGE_SIZE = 12;
const sectorLabel = (value: string) => value.replace(/-/g, " ").replace(/^./, c => c.toUpperCase());
const expired = (job: Job) => !!job.application_deadline && Date.parse(job.application_deadline) < Date.now();
const deadline = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function JobList() {
  const [catalog, setCatalog] = useState<Job[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [sector, setSector] = useState("");
  const [place, setPlace] = useState("");
  const [availability, setAvailability] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    api.listJobs().then(data => { if (active) { setCatalog(data); setJobs(data); setLoaded(true); } })
      .catch(() => { if (active) setError("Could not load jobs. Reload this page to try again."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; sequence.current++; };
  }, []);
  const search = async (clear = false) => {
    const query = clear ? "" : q.trim();
    const request = ++sequence.current;
    setBusy(true); setError("");
    try {
      let data = catalog;
      if (query) {
        data = await api.listJobs(query);
      }
      if (request !== sequence.current) return;
      setJobs(data); setSubmitted(query); setPage(1);
      if (clear) { setQ(""); setSector(""); setPlace(""); setAvailability(""); }
    } catch { if (request === sequence.current) setError("Search could not complete. Your previous results are still shown. Please try again."); }
    finally { if (request === sequence.current) setBusy(false); }
  };
  const sectors = [...new Set(catalog.map(j => j.sector).filter((s): s is string => !!s))].sort();
  const places = [...new Set(catalog.map(j => j.location).filter(Boolean))].sort();
  const filtered = jobs.filter(j => (!sector || j.sector === sector) && (!place || j.location === place) && (!availability || (availability === "open" ? !!j.application_deadline && !expired(j) : availability === "expired" ? expired(j) : !j.application_deadline)));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(sector || place || availability);
  const changePage = (next: number) => { setPage(next); resultHeading.current?.focus(); };
  return <div className="job-catalog">
    <header className="catalog-heading">
      <div className="catalog-intro">
        <p className="catalog-kicker">Browse jobs</p>
        <h1>Find your next role.</h1>
        <form className="catalog-search" role="search" aria-label="Jobs" onSubmit={e => {
          e.preventDefault();
          if (loaded && !busy) void search();
        }}>
          <label htmlFor="vacancy-query">Search by title, skill or location</label>
          <div className="search-controls">
            <input id="vacancy-query" type="search" aria-describedby="vacancy-query-help" value={q} disabled={!loaded} onChange={e => setQ(e.target.value)} placeholder="e.g. Python or Stockholm" />
            <button type="submit" disabled={!loaded} aria-disabled={busy && loaded ? true : undefined}>{busy && loaded ? "Searching…" : "Search jobs"}</button>
          </div>
          <p id="vacancy-query-help">All keywords must match. Use terms from the language of the job description.</p>
        </form>
      </div>
      <div className="personal-match-callout">
        <p className="catalog-kicker">How to apply</p>
        <h2>Choose a role. Share your experience.</h2>
        <p>Open a job to review its requirements and submit your fictional CV. We will compare your skills with that role and show your next steps.</p>
      </div>
    </header>
    <div className="catalog-layout"><aside className="catalog-filters" aria-label="Filter jobs">
      <div className="filter-heading"><h2>Filters</h2><button type="button" disabled={!loaded || busy} onClick={() => { setSector(""); setPlace(""); setAvailability(""); setPage(1); }}>Reset filters</button></div>
      <div className="filter-fields">
        <div><label htmlFor="sector-filter">Sector</label><select id="sector-filter" value={sector} disabled={busy || !loaded} onChange={e => { setSector(e.target.value); setPage(1); }}><option value="">All sectors</option>{sectors.map(s => <option key={s} value={s}>{sectorLabel(s)}</option>)}</select></div>
        <div><label htmlFor="place-filter">Location</label><select id="place-filter" value={place} disabled={busy || !loaded} onChange={e => { setPlace(e.target.value); setPage(1); }}><option value="">All locations</option>{places.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label htmlFor="deadline-filter">Deadline in dataset</label><select id="deadline-filter" value={availability} disabled={busy || !loaded} onChange={e => { setAvailability(e.target.value); setPage(1); }}><option value="">Any deadline</option><option value="open">Deadline not passed</option><option value="expired">Deadline passed</option><option value="unknown">Not specified</option></select></div>
      </div>
      <details className="catalog-data-note">
        <summary>About demo jobs</summary>
        <p>Starter jobs come from a demo snapshot. Verify the job’s current status with the employer before relying on its deadline.</p>
      </details>
    </aside>
    <section className="catalog-results" aria-busy={busy} aria-label="Job results">
      <div className="catalog-results-heading"><div><h2 ref={resultHeading} tabIndex={-1}>{submitted ? `Results for “${submitted}”` : "Jobs"}</h2><p role="status">{busy ? "Loading jobs…" : loaded ? `${filtered.length} ${filtered.length === 1 ? "job" : "jobs"}${hasFilters ? " after filters" : ""}` : "Jobs unavailable"}</p></div>{submitted && <button type="button" className="clear-query" disabled={busy} onClick={() => void search(true)}>Clear search</button>}</div>
      {submitted && <p className="search-scope">Matching jobs across the full catalog. Title and skill matches appear first.</p>}
      {error && <p role="alert" className="catalog-error">{error}</p>}
      {!busy && loaded && !filtered.length && <div className="catalog-empty"><h3>No jobs match this view</h3><p>Try a broader skill, another location, or remove filters to explore more opportunities.</p><button type="button" onClick={() => void search(true)}>Show all jobs</button></div>}
      {visible.map(job => <article className="vacancy-row" key={job.id}>
        <div className="vacancy-meta"><span>{job.sector ? sectorLabel(job.sector) : "Sector not specified"}</span><span className="vacancy-source">{job.source === "search" ? "Demo job" : "Employer posting"}</span></div>
        <h3>{job.title}</h3>
        <p className="vacancy-location">{job.location || "Location not specified"}</p>
        {job.ad_text && <p className="vacancy-excerpt">{job.ad_text.replace(/^.*?\n\n/, "")}</p>}
        {!!job.skills?.length && <div className="vacancy-skills" aria-label="Identified skills">{job.skills.slice(0, 4).map(s => <span key={s.concept_id}>{s.label}</span>)}{job.skills.length > 4 && <span>+{job.skills.length - 4} more</span>}</div>}
        {job.application_deadline && <div className="vacancy-facts"><span className={expired(job) ? "deadline-expired" : ""}>{expired(job) ? "Deadline passed" : "Deadline"} · {deadline(job.application_deadline)}</span></div>}
        <footer className="vacancy-actions">
          <details className="vacancy-description"><summary>Description &amp; requirements</summary><p>{job.ad_text || "Full description is not available in this result."}</p>{!!job.skills?.length && <><h4>Identified skills</h4><ul>{job.skills.map(s => <li key={s.concept_id}>{s.label}</li>)}</ul></>}{!job.skills?.length && <p className="catalog-muted">Skills have not been identified for this job yet. Review the original description.</p>}</details>
          <Link to={`/jobs/${encodeURIComponent(job.id)}/apply`} aria-label={`Review & apply for ${job.title}`}>Review &amp; apply <span aria-hidden="true">→</span></Link>
        </footer>
      </article>)}
      {!busy && filtered.length > 0 && <nav className="catalog-pagination" aria-label="Results pages"><button type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>← Previous</button><span>Page {currentPage} of {pages} · {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span><button type="button" disabled={currentPage >= pages} onClick={() => changePage(currentPage + 1)}>Next →</button></nav>}
    </section></div>
  </div>;
}
