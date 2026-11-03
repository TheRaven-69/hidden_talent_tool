import { Link, NavLink, Route, Routes } from "react-router-dom";
import CreateJob from "./pages/employer/CreateJob";
import CandidateDashboard from "./pages/employer/CandidateDashboard";
import JobList from "./pages/candidate/JobList";
import Apply from "./pages/candidate/Apply";
import Assessment from "./pages/candidate/Assessment";
import Recommendations from "./pages/candidate/Recommendations";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header"><Link className="brand" to="/recommendations">hidden talent<span>Find the skills behind the story.</span></Link><nav aria-label="Main navigation">
        <NavLink to="/" end>All jobs</NavLink>
        <NavLink to="/recommendations">Find matching jobs</NavLink>
        <NavLink to="/employer/new">Employer · Create job</NavLink>
      </nav></header><main id="main-content">
      <Routes>
        <Route path="/" element={<JobList />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/jobs/:jobId/apply" element={<Apply />} />
        <Route path="/assessment/:applicationId" element={<Assessment />} />
        <Route path="/employer/new" element={<CreateJob />} />
        <Route path="/employer/jobs/:jobId/candidates" element={<CandidateDashboard />} />
      </Routes></main>
    </div>
  );
}
