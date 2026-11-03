import { Link, Route, Routes } from "react-router-dom";
import CreateJob from "./pages/employer/CreateJob";
import CandidateDashboard from "./pages/employer/CandidateDashboard";
import JobList from "./pages/candidate/JobList";
import Apply from "./pages/candidate/Apply";
import Assessment from "./pages/candidate/Assessment";

export default function App() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Link to="/">Jobs</Link>
        <Link to="/employer/new">Create job</Link>
      </nav>
      <Routes>
        <Route path="/" element={<JobList />} />
        <Route path="/jobs/:jobId/apply" element={<Apply />} />
        <Route path="/assessment/:applicationId" element={<Assessment />} />
        <Route path="/employer/new" element={<CreateJob />} />
        <Route path="/employer/jobs/:jobId/candidates" element={<CandidateDashboard />} />
      </Routes>
    </div>
  );
}
