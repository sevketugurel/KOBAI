import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from "react-router-dom";
import TenantLayout from "./components/layout/TenantLayout";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import TaxCalendarPage from "./pages/TaxCalendarPage";
import TenantDashboardStub from "./pages/TenantDashboardStub";
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/register", element: _jsx(RegisterPage, {}) }), _jsx(Route, { path: "/dashboard/:jobId", element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "/demo/dashboard/:jobId", element: _jsx(DashboardPage, {}) }), _jsxs(Route, { path: ":slug", element: _jsx(TenantLayout, {}), children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "dashboard", replace: true }) }), _jsx(Route, { path: "dashboard", element: _jsx(TenantDashboardStub, {}) }), _jsx(Route, { path: "tax-calendar", element: _jsx(TaxCalendarPage, {}) })] })] }));
}
