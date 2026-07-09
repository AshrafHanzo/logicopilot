import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { NotAuthorizedPage } from "../pages/NotAuthorizedPage";
import { SuperAdminDashboard } from "../pages/super-admin/DashboardShell";
import { TenantAdminDashboard } from "../pages/tenant-admin/DashboardShell";
import { OperatorDashboard } from "../pages/operator/DashboardShell";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/not-authorized" element={<NotAuthorizedPage />} />
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenant-admin"
        element={
          <ProtectedRoute allowedRoles={["tenant_admin"]}>
            <TenantAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator"
        element={
          <ProtectedRoute allowedRoles={["operator"]}>
            <OperatorDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
