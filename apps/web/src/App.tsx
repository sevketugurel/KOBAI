import { Navigate, Route, Routes } from "react-router-dom";

import TenantLayout from "./components/layout/TenantLayout";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import TenantDashboardStub from "./pages/TenantDashboardStub";

export default function App() {
  return (
    <Routes>
      {/* Public landing + auth */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* v1 demo akışı — auth gerekmez (mevcut MVP) */}
      <Route path="/dashboard/:jobId" element={<DashboardPage />} />
      <Route path="/demo/dashboard/:jobId" element={<DashboardPage />} />

      {/* v2 tenant-bound rotalar */}
      <Route path=":slug" element={<TenantLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<TenantDashboardStub />} />
      </Route>
    </Routes>
  );
}
