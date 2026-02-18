import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppearanceProvider } from "./contexts/AppearanceContext";
import { ProfileProvider } from "./contexts/ProfileContext";
import { AppShell } from "./components/layout/AppShell";
import Index from "./pages/Index";
import { SettingsLayout, ProfileSection, SecuritySection, NotificationsSection, AppearanceSection, DataPrivacySection } from "./components/settings";
import IntegrationsPage from "./pages/IntegrationsPage";
import IntegrationDetailPage from "./pages/IntegrationDetailPage";
import BillingPage from "./pages/BillingPage";
import ChatPage from "./pages/ChatPage";
import HealthScorecardPage from "./pages/HealthScorecardPage";
import PriceArchitectPage from "./pages/PriceArchitectPage";
import DataMappingPage from "./pages/DataMappingPage";
import DataQualityPage from "./pages/DataQualityPage";
import RulesPage from "./pages/RulesPage";
import OnboardingPage from "./pages/OnboardingPage";
import NotFoundPage from "./pages/NotFoundPage";
import ErrorPage from "./pages/ErrorPage";

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: "system-ui, sans-serif", background: "#0f1117", color: "#e5e7eb", minHeight: "100vh" }}>
          <h1 style={{ color: "#ef4444", marginBottom: 16 }}>Something went wrong</h1>
          <pre style={{ background: "#1a1d27", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 14, color: "#f87171" }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ background: "#1a1d27", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ marginTop: 16, padding: "8px 20px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AppearanceProvider>
        <ProfileProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Onboarding - no shell */}
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* Main app with AppShell layout */}
              <Route element={<AppShell />}>
                <Route path="/" element={<Index />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/tools/health-scorecard" element={<HealthScorecardPage />} />
                <Route path="/tools/price-architect" element={<PriceArchitectPage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
                <Route path="/data-mapping" element={<DataMappingPage />} />
                <Route path="/data-quality" element={<DataQualityPage />} />
                <Route path="/rules" element={<RulesPage />} />
                <Route path="/billing" element={<BillingPage />} />

                {/* Settings with sub-routes */}
                <Route path="/settings" element={<SettingsLayout />}>
                  <Route index element={<Navigate to="/settings/profile" replace />} />
                  <Route path="profile" element={<ProfileSection />} />
                  <Route path="security" element={<SecuritySection />} />
                  <Route path="notifications" element={<NotificationsSection />} />
                  <Route path="appearance" element={<AppearanceSection />} />
                  <Route path="data-privacy" element={<DataPrivacySection />} />
                </Route>

                <Route path="/error" element={<ErrorPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </ProfileProvider>
        </AppearanceProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
