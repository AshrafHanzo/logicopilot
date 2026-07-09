import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { superAdminFeatures } from "./features/registry";

function SuperAdminHome() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Super Admin Panel</h1>
      <p className="text-gray-600 mb-6">
        Onboarding Wizard — 7 pluggable features. Each links to its own page below.
      </p>
      <ul className="space-y-2">
        {superAdminFeatures.map((f) => (
          <li key={f.path}>
            <Link to={f.path} className="text-indigo-600 hover:underline">
              {f.order}. {f.navLabel}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/super-admin" replace />} />
        <Route path="/super-admin" element={<SuperAdminHome />} />
        {superAdminFeatures.map((f) => (
          <Route key={f.path} path={f.path} element={<f.component />} />
        ))}
      </Routes>
    </BrowserRouter>
  );
}
