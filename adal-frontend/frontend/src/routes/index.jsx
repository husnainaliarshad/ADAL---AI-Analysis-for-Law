import React from "react";
import { Routes, Route } from "react-router-dom";
import Landing from "../pages/Landing";
import NotFound from "../pages/NotFound";
import ResetPassword from "../pages/ResetPassword";
import Login from "../pages/Auth/Login";
import Register from "../pages/Auth/Register";
import Dashboard from "../pages/Dashboard/Dashboard";
import DocumentUpload from "../pages/Documents/DocumentUpload";
import DocumentList from "../pages/Documents/DocumentList";
import DocumentDetail from "../pages/Documents/DocumentDetail";
import CitationList from "../pages/Citations/CitationList";
import CitationDetail from "../pages/Citations/CitationDetail";
import ClaimList from "../pages/Claims/ClaimList";
import ClaimDetail from "../pages/Claims/ClaimDetail";
import TermsAndServices from "../pages/TermsAndServices";
import Privacy from "../pages/Privacy";
import NotificationsPage from "../pages/NotificationsPage";
import SettingsPage from "../pages/SettingsPage";
import SummaryPage from "../pages/Summary/SummaryPage";
import DraftingAssistantPage from "../pages/DocumentDraftingAssistant/DraftingAssistantPage";
import ChatPage from "../pages/ChatPage";
import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";
import { ENABLE_DEV_ROUTES } from "../config/runtimeConfig";

export default function AppRoutes() {
  const enableDevRoutes = ENABLE_DEV_ROUTES;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/notfound" element={<PublicRoute><NotFound /></PublicRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/documents" element={<PrivateRoute><DocumentList /></PrivateRoute>} />
      <Route path="/documents/:documentId" element={<PrivateRoute><DocumentDetail /></PrivateRoute>} />
      <Route path="/documents/upload" element={<PrivateRoute><DocumentUpload /></PrivateRoute>} />
      <Route path="/documents/:documentId/citations" element={<PrivateRoute><CitationList /></PrivateRoute>} />
      <Route path="/citations/document/:documentId" element={<PrivateRoute><CitationList /></PrivateRoute>} />
      <Route path="/citations/:citationId" element={<PrivateRoute><CitationDetail /></PrivateRoute>} />
      <Route path="/documents/:documentId/claims" element={<PrivateRoute><ClaimList /></PrivateRoute>} />
      <Route path="/claims" element={<PrivateRoute><ClaimList /></PrivateRoute>} />
      <Route path="/claims/:claimId" element={<PrivateRoute><ClaimDetail /></PrivateRoute>} />
      <Route path="/summary" element={<PrivateRoute><SummaryPage /></PrivateRoute>} />
      <Route path="/drafting-assistant" element={<PrivateRoute><DraftingAssistantPage /></PrivateRoute>} />
      <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
      <Route path="/dashboard/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
      <Route path="/dashboard/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      {/* Cases are now managed via sidebar selector - no standalone pages needed */}
      <Route path="/terms" element={<PublicRoute><TermsAndServices /></PublicRoute>} />
      <Route path="/privacy" element={<PublicRoute><Privacy /></PublicRoute>} />
      {enableDevRoutes && <Route path="/__dev__/landing" element={<Landing />} />}
      {enableDevRoutes && <Route path="/__dev__/login" element={<Login />} />}
      {enableDevRoutes && <Route path="/__dev__/register" element={<Register />} />}
      {enableDevRoutes && <Route path="/__dev__/reset-password" element={<ResetPassword />} />}
      {enableDevRoutes && <Route path="/__dev__/dashboard" element={<Dashboard />} />}
      {enableDevRoutes && <Route path="/__dev__/documents" element={<DocumentList />} />}
      {enableDevRoutes && <Route path="/__dev__/upload" element={<DocumentUpload />} />}
      {enableDevRoutes && <Route path="/__dev__/documents/:documentId" element={<DocumentDetail />} />}
      {enableDevRoutes && <Route path="/__dev__/documents/:documentId/citations" element={<CitationList />} />}
      {enableDevRoutes && <Route path="/__dev__/citations/document/:documentId" element={<CitationList />} />}
      {enableDevRoutes && <Route path="/__dev__/citations/:citationId" element={<CitationDetail />} />}
      {enableDevRoutes && <Route path="/__dev__/claims" element={<ClaimList />} />}
      {enableDevRoutes && <Route path="/__dev__/documents/:documentId/claims" element={<ClaimList />} />}
      {enableDevRoutes && <Route path="/__dev__/claims/:claimId" element={<ClaimDetail />} />}
      {enableDevRoutes && <Route path="/__dev__/summary" element={<SummaryPage />} />}
      {enableDevRoutes && <Route path="/__dev__/notifications" element={<NotificationsPage />} />}
      {enableDevRoutes && <Route path="/__dev__/settings" element={<SettingsPage />} />}
      {enableDevRoutes && <Route path="/__dev__/drafting-assistant" element={<DraftingAssistantPage />} />}
      {enableDevRoutes && <Route path="/__dev__/chat" element={<ChatPage />} />}
      {enableDevRoutes && <Route path="/__dev__/terms" element={<TermsAndServices />} />}
      {enableDevRoutes && <Route path="/__dev__/privacy" element={<Privacy />} />}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
