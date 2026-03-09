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
import Index from "./pages/Index";
import Forecast from "./pages/Forecast";
import Mercado from "./pages/Mercado";
import Analise from "./pages/Analise";
import Portfolio from "./pages/Portfolio";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Alertas from "./pages/Alertas";
import Comparar from "./pages/Comparar";
import Backtesting from "./pages/Backtesting";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";

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
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
