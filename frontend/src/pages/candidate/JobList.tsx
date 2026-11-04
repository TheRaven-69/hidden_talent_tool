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
      .catch(() => { if (active) setError("Could not load vacancies. Reload this page to try again."); })
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
        const hits = await api.listJobs(query);
        const byId = new Map(catalog.map(j => [j.id, j]));
        data = hits.map(hit => ({ ...hit, ...byId.get(hit.id) }));
        const ids = new Set(data.map(j => j.id));
        const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
        data = data.concat(catalog.filter(j => j.source !== "search" && !ids.has(j.id) && words.some(word => `${j.title} ${j.ad_text} ${(j.skills || []).map(s => s.label).join(" ")}`.toLocaleLowerCase().includes(word))));
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
  const changePage = (next: number) => { setPage(next); resultHeading.current?.focus(); };
  return <div className="job-catalog">
    <header className="catalog-heading"><div><p className="catalog-kicker">Opportunity directory</p><h1>Explore the work.<br />Find your next direction.</h1><p>Browse roles, understand the requirements and discover where your experience could fit.</p></div><div className="personal-match-callout"><h2>Not sure where to start?</h2><p>Let your experience guide the search. Get recommendations with skill evidence and clear gaps.</p><Link to="/recommendations">Find jobs for my skills →</Link></div></header>
    <form className="catalog-search" onSubmit={e => { e.preventDefault(); void search(); }}>
      <label htmlFor="vacancy-query">Search roles or skills</label><div><input id="vacancy-query" value={q} disabled={busy || !loaded} onChange={e => setQ(e.target.value)} placeholder="Try Python, customer service or logistics" /><button type="submit" disabled={busy || !loaded}>{busy ? "Searching…" : "Search vacancies →"}</button></div><p>Search by meaning across the starter catalog. Employer-created roles are also checked for matching words.</p>
    </form>
    <div className="catalog-layout"><aside className="catalog-filters" aria-label="Filter vacancies"><div className="filter-heading"><h2>Refine results</h2><button type="button" disabled={busy || !loaded} onClick={() => { setSector(""); setPlace(""); setAvailability(""); setPage(1); }}>Reset filters</button></div>
      <label htmlFor="sector-filter">Sector</label><select id="sector-filter" value={sector} disabled={busy} onChange={e => { setSector(e.target.value); setPage(1); }}><option value="">All sectors</option>{sectors.map(s => <option key={s} value={s}>{sectorLabel(s)}</option>)}</select>
      <label htmlFor="place-filter">Location</label><select id="place-filter" value={place} disabled={busy} onChange={e => { setPlace(e.target.value); setPage(1); }}><option value="">All locations</option>{places.map(p => <option key={p} value={p}>{p}</option>)}</select>
      <label htmlFor="deadline-filter">Deadline in dataset</label><select id="deadline-filter" value={availability} disabled={busy} onChange={e => { setAvailability(e.target.value); setPage(1); }}><option value="">Any deadline</option><option value="open">Deadline not passed</option><option value="expired">Deadline passed</option><option value="unknown">Not specified</option></select>
      <p className="catalog-data-note"><strong>About these vacancies</strong>Starter jobs are a frozen demo snapshot. A future deadline does not confirm that a vacancy is still open. Verify its status before real use.</p>
      <p className="catalog-data-note">Explore the role and its requirements. A human makes the hiring decision.</p>
    </aside>
    <section className="catalog-results" aria-busy={busy} aria-label="Vacancy results">
      <div className="catalog-results-heading"><div><h2 ref={resultHeading} tabIndex={-1}>{submitted ? `Results for “${submitted}”` : "All opportunities"}</h2><p role="status">{busy ? "Loading vacancies…" : `${filtered.length} ${filtered.length === 1 ? "vacancy" : "vacancies"}${sector || place || availability ? " after filters" : ""}`}</p></div>{submitted && <button type="button" className="clear-query" disabled={busy} onClick={() => void search(true)}>Clear search</button>}</div>
      {submitted && <p className="search-scope">Search returns up to 20 starter matches, plus matching employer-created roles. Results retain search relevance order.</p>}
      {error && <p role="alert" className="catalog-error">{error}</p>}
      {!busy && loaded && !filtered.length && <div className="catalog-empty"><h3>No vacancies match this view</h3><p>Try a broader skill, another location, or remove filters to explore more opportunities.</p><button type="button" onClick={() => void search(true)}>Show all vacancies</button></div>}
      {visible.map(job => <article className="vacancy-row" key={job.id}>
        <div className="vacancy-meta"><span>{job.sector ? sectorLabel(job.sector) : "Sector not specified"}</span><span>{job.source === "search" ? "Starter snapshot" : "Employer-created"}</span></div>
        <h3>{job.title}</h3><p className="vacancy-location">{job.location || "Location not specified"}</p>
        {job.ad_text && <p className="vacancy-excerpt">{job.ad_text.replace(/^.*?\n\n/, "")}</p>}
        {!!job.skills?.length && <div className="vacancy-skills" aria-label="Identified skills">{job.skills.slice(0, 4).map(s => <span key={s.concept_id}>{s.label}</span>)}{job.skills.length > 4 && <span>+{job.skills.length - 4} more</span>}</div>}
        {job.application_deadline && <div className="vacancy-facts"><span className={expired(job) ? "deadline-expired" : ""}>{expired(job) ? "Deadline passed" : "Deadline"} · {deadline(job.application_deadline)}</span></div>}
        <details className="vacancy-description"><summary>Read description &amp; requirements</summary><p>{job.ad_text || "Full description is not available in this result."}</p>{!!job.skills?.length && <><h4>Identified skills</h4><ul>{job.skills.map(s => <li key={s.concept_id}>{s.label}</li>)}</ul></>}{!job.skills?.length && <p className="catalog-muted">Skills have not been identified for this vacancy yet. Review the original description.</p>}</details>
        <div className="vacancy-actions"><span>Demo application · CV review and tailored assessment</span><Link to={`/jobs/${encodeURIComponent(job.id)}/apply`}>Review &amp; apply →</Link></div>
      </article>)}
      {!busy && filtered.length > 0 && <nav className="catalog-pagination" aria-label="Results pages"><button type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>← Previous</button><span>Page {currentPage} of {pages} · {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span><button type="button" disabled={currentPage >= pages} onClick={() => changePage(currentPage + 1)}>Next →</button></nav>}
    </section></div>
  </div>;
}
