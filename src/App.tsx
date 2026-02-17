import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppShell } from "./components/layout/AppShell";
import Index from "./pages/Index";
import { SettingsLayout, ProfileSection, SecuritySection, NotificationsSection, AppearanceSection, DataPrivacySection } from "./components/settings";
import IntegrationsPage from "./pages/IntegrationsPage";
import IntegrationDetailPage from "./pages/IntegrationDetailPage";
import BillingPage from "./pages/BillingPage";
import ChatPage from "./pages/ChatPage";
import OnboardingPage from "./pages/OnboardingPage";
import NotFoundPage from "./pages/NotFoundPage";
import ErrorPage from "./pages/ErrorPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
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
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/integrations/:slug" element={<IntegrationDetailPage />} />
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
