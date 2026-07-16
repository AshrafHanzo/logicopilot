import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { NotAuthorizedPage } from "../pages/NotAuthorizedPage";
import { SuperAdminDashboard } from "../pages/super-admin/DashboardShell";
import { TemplateCreationWizard } from "../pages/super-admin/template-wizard/TemplateCreationWizard";
import { TemplateListPage } from "../pages/super-admin/TemplateListPage";
import { TenantAdminDashboard } from "../pages/tenant-admin/DashboardShell";
import { OperatorDashboard } from "../pages/operator/DashboardShell";
import { JobsPage } from "../pages/jobs/JobsPage";
import { JobRunPage } from "../pages/jobs/JobRunPage";
import { DataTransformationPage } from "../pages/tenant-admin/DataTransformationPage";
import { DataTransformationDetailPage } from "../pages/tenant-admin/DataTransformationDetailPage";
import { ErpAccessPage } from "../pages/tenant-admin/ErpAccessPage";

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
        path="/super-admin/template-creation"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <TemplateCreationWizard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/super-admin/template-list"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <TemplateListPage />
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
        path="/tenant-admin/data-transformation"
        element={
          <ProtectedRoute allowedRoles={["tenant_admin"]}>
            <DataTransformationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenant-admin/data-transformation/:groupId"
        element={
          <ProtectedRoute allowedRoles={["tenant_admin"]}>
            <DataTransformationDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenant-admin/erp-access"
        element={
          <ProtectedRoute allowedRoles={["tenant_admin"]}>
            <ErpAccessPage />
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
      <Route
        path="/jobs"
        element={
          <ProtectedRoute allowedRoles={["operator", "super_admin"]}>
            <JobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:jobId"
        element={
          <ProtectedRoute allowedRoles={["operator", "super_admin"]}>
            <JobRunPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
