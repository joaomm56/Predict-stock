import { lazy, Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import BackendBanner from "@/components/BackendBanner";

const Index        = lazy(() => import("./pages/Index"));
const Forecast     = lazy(() => import("./pages/Forecast"));
const Mercado      = lazy(() => import("./pages/Mercado"));
const Analise      = lazy(() => import("./pages/Analise"));
const Portfolio    = lazy(() => import("./pages/Portfolio"));
const Profile      = lazy(() => import("./pages/Profile"));
const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Pricing      = lazy(() => import("./pages/Pricing"));
const Login        = lazy(() => import("./pages/Login"));
const Register     = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword  = lazy(() => import("./pages/ResetPassword"));
const Alertas      = lazy(() => import("./pages/Alertas"));
const Comparar     = lazy(() => import("./pages/Comparar"));
const Backtesting  = lazy(() => import("./pages/Backtesting"));
const Terms        = lazy(() => import("./pages/Terms"));
const Privacy      = lazy(() => import("./pages/Privacy"));
const NotFound     = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <BackendBanner />
        <Analytics />
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* Protected */}
              <Route path="/mercado"     element={<ProtectedRoute><Mercado /></ProtectedRoute>} />
              <Route path="/forecast"    element={<ProtectedRoute><Forecast /></ProtectedRoute>} />
              <Route path="/analise"     element={<ProtectedRoute><Analise /></ProtectedRoute>} />
              <Route path="/portfolio"   element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
              <Route path="/profile"     element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/alertas"     element={<ProtectedRoute><Alertas /></ProtectedRoute>} />
              <Route path="/comparar"    element={<ProtectedRoute><Comparar /></ProtectedRoute>} />
              <Route path="/backtesting" element={<ProtectedRoute><Backtesting /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
