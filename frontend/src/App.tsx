import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import CreateJob from "./pages/employer/CreateJob";
import Applications from "./pages/employer/Applications";
import ApplicationDetails from "./pages/employer/ApplicationDetails";
import JobList from "./pages/candidate/JobList";
import Apply from "./pages/candidate/Apply";
import Assessment from "./pages/candidate/Assessment";

export default function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Fynd Talent">
          <img src="/fynd-mark.svg" width="42" height="42" alt="" />
          <span className="brand-wordmark" aria-hidden="true">
            f<span>y</span>nd
            <small>Talent</small>
          </span>
        </Link>
        <nav className="app-nav" aria-label="Main navigation">
          <div className="nav-group" role="group" aria-labelledby="candidate-nav-label">
            <span className="nav-group-label" id="candidate-nav-label">Candidates</span>
            <div className="nav-links">
              <NavLink to="/" end>Browse jobs</NavLink>
            </div>
          </div>
          <div className="nav-group" role="group" aria-labelledby="employer-nav-label">
            <span className="nav-group-label" id="employer-nav-label">Employers</span>
            <div className="nav-links">
              <NavLink to="/employer/new">Post a job</NavLink>
              <NavLink to="/employer/applications">Applications</NavLink>
            </div>
          </div>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<JobList />} />
          <Route path="/recommendations" element={<Navigate to="/" replace />} />
          <Route path="/jobs/:jobId/apply" element={<Apply />} />
          <Route path="/assessment/:applicationId" element={<Assessment />} />
          <Route path="/employer/new" element={<CreateJob />} />
          <Route path="/employer/applications" element={<Applications />} />
          <Route path="/employer/applications/:applicationId" element={<ApplicationDetails />} />
          <Route path="/employer/jobs/:jobId/candidates" element={<Applications />} />
        </Routes>
      </main>
    </div>
  );
}
