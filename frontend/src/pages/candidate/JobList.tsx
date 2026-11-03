import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Job } from "../../api/client";

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => { api.listJobs().then(setJobs); }, []);
  const search = () => api.listJobs(q).then(setJobs);

  return (
    <div>
      <h2>Jobs</h2>
      <input placeholder="Search jobs" value={q} onChange={(e) => setQ(e.target.value)} />
      <button onClick={search}>Search</button>
      <ul>
        {jobs.map((j) => (
          <li key={j.id}>
            {j.title} – {j.location} <Link to={`/jobs/${j.id}/apply`}>Apply</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
