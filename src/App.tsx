import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AdminProvider, useAdmin } from "@/contexts/AdminContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MaintenanceBanner, useMaintenanceMode } from "@/components/MaintenanceBanner";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import Home from "./pages/Home";

// Lazy load non-critical routes for better initial bundle size
const Docs = lazy(() => import("./pages/Docs"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Generate = lazy(() => import("./pages/Generate"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin routes
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminBootstrap = lazy(() => import("./pages/admin/AdminBootstrap"));
const AdminInviteRedeem = lazy(() => import("./pages/admin/AdminInviteRedeem"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminModels = lazy(() => import("./pages/admin/AdminModels"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminProviders = lazy(() => import("./pages/admin/AdminProviders"));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminIncidents = lazy(() => import("./pages/admin/AdminIncidents"));
const AdminBilling = lazy(() => import("./pages/admin/AdminBilling"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminAPIKeys = lazy(() => import("./pages/admin/AdminAPIKeys"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));

const queryClient = new QueryClient();

// Minimal loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Minimal loading fallback for maintenance gate
const GateLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Maintenance mode gate - blocks protected routes for non-admin users
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { 
    isMaintenanceMode, 
    maintenanceMessage, 
    maintenancePages, 
    scheduledEnd,
    isLoading: maintenanceLoading 
  } = useMaintenanceMode();
  const { isOwner, isSuperAdmin, loading: adminLoading } = useAdmin();
  const { loading: authLoading } = useAuth();
  const location = useLocation();

  // Use dynamic maintenance pages from settings
  const isProtectedRoute = maintenancePages.some(route => 
    location.pathname.startsWith(route)
  );

  // Show loading state while determining access on protected routes
  if (isProtectedRoute && (authLoading || adminLoading || maintenanceLoading)) {
    return <GateLoader />;
  }

  // Allow bypass for Owner and Super Admin
  const canBypass = isOwner || isSuperAdmin;

  // Show maintenance screen if:
  // - Maintenance mode is ON (manual or scheduled)
  // - User is on a protected route
  // - User is NOT Owner or Super Admin
  if (isMaintenanceMode && isProtectedRoute && !canBypass) {
    return <MaintenanceScreen message={maintenanceMessage} scheduledEnd={scheduledEnd} />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <MaintenanceBanner />
            <MaintenanceGate>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/signin" element={<SignIn />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/pricing" element={<Pricing />} />
                  
                  {/* Protected user routes */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/generate" element={<ProtectedRoute><Generate /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  
                  {/* Admin public routes */}
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin/bootstrap" element={<AdminBootstrap />} />
                  <Route path="/admin/invite/:token" element={<AdminInviteRedeem />} />
                  
                  {/* Admin protected routes */}
                  <Route path="/admin" element={<AdminProtectedRoute requiredRole="moderator"><AdminLayout /></AdminProtectedRoute>}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="models" element={<AdminProtectedRoute requiredRole="admin"><AdminModels /></AdminProtectedRoute>} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="settings" element={<AdminProtectedRoute requiredRole="super_admin"><AdminSettings /></AdminProtectedRoute>} />
                    <Route path="logs" element={<AdminLogs />} />
                    <Route path="providers" element={<AdminProtectedRoute requiredRole="admin"><AdminProviders /></AdminProtectedRoute>} />
                    <Route path="security" element={<AdminProtectedRoute requiredRole="admin"><AdminSecurity /></AdminProtectedRoute>} />
                    <Route path="incidents" element={<AdminIncidents />} />
                    <Route path="billing" element={<AdminProtectedRoute requiredRole="admin"><AdminBilling /></AdminProtectedRoute>} />
                    <Route path="analytics" element={<AdminAnalytics />} />
                    <Route path="api-keys" element={<AdminProtectedRoute requiredRole="admin"><AdminAPIKeys /></AdminProtectedRoute>} />
                    <Route path="notifications" element={<AdminProtectedRoute requiredRole="admin"><AdminNotifications /></AdminProtectedRoute>} />
                  </Route>
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </MaintenanceGate>
          </BrowserRouter>
        </TooltipProvider>
      </AdminProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
