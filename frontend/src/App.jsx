import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { isNative } from './utils/platform';
import api from './utils/api';

// Layout
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import ImpersonationBanner from './components/common/ImpersonationBanner';
import PremiumGate from './components/common/PremiumGate';

// Core-path pages stay eager: first paint (Landing), auth, and the scan flow.
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Scan from './pages/Scan';
import ProductResult from './pages/ProductResult';

// Everything else is route-split so heavy dependencies (recharts in
// Progress/Budget, @zxing in PantryAudit, the 2k-line Admin console) load
// only when their route is visited.
const Features = lazy(() => import('./pages/Features'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Pantry = lazy(() => import('./pages/Pantry'));
const PantryAudit = lazy(() => import('./pages/PantryAudit'));
const PantryPhotoScan = lazy(() => import('./pages/PantryPhotoScan'));
const Swaps = lazy(() => import('./pages/Swaps'));
const Recipes = lazy(() => import('./pages/Recipes'));
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'));
const Shopping = lazy(() => import('./pages/Shopping'));
const ShoppingList = lazy(() => import('./pages/ShoppingList'));
const ShoppingMode = lazy(() => import('./pages/ShoppingMode'));
const Progress = lazy(() => import('./pages/Progress'));
const Profile = lazy(() => import('./pages/Profile'));
const Subscription = lazy(() => import('./pages/Subscription'));
const ReceiptScan = lazy(() => import('./pages/ReceiptScan'));
const Budget = lazy(() => import('./pages/Budget'));
const Admin = lazy(() => import('./pages/Admin'));
const Family = lazy(() => import('./pages/Family'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/Terms'));
const Support = lazy(() => import('./pages/Support'));
const AboutScoring = lazy(() => import('./pages/AboutScoring'));
const JoinFamily = lazy(() => import('./pages/JoinFamily'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="animate-spin w-8 h-8 border-4 border-[#c8f135] border-t-transparent rounded-full" />
    </div>
  );
}

// Auth gate — only for features that truly need login
function AuthGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#c8f135] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Public route: redirects to /scan if already logged in
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#c8f135] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (user) return <Navigate to="/scan" replace />;
  return children;
}

// First-time visitor check
function FirstVisitGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: '#c8f135', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // Logged in → go scan
  if (user) return <Navigate to="/scan" replace />;

  // Not logged in → show landing page
  return <Landing />;
}

// Native app lifecycle — handles back button, deep links, status bar
function NativeLifecycle() {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isNative) return;
    
    let cleanup = [];
    
    (async () => {
      // Status bar
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        StatusBar.setBackgroundColor({ color: '#10b981' });
        StatusBar.setStyle({ style: Style.Light });
      } catch {}

      // Hide splash screen after app loads
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        SplashScreen.hide();
      } catch {}

      // Android back button → navigate back or exit
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const backHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        });
        cleanup.push(() => backHandler.remove());

        // Deep links: ick://product/012345678901
        const urlHandler = CapApp.addListener('appUrlOpen', (event) => {
          const url = new URL(event.url);
          const path = url.pathname || url.hash?.replace('#', '') || '/';
          navigate(path);
        });
        cleanup.push(() => urlHandler.remove());
      } catch {}

      // Initialize push notifications
      try {
        const { initPushNotifications } = await import('./utils/nativePush');
        await initPushNotifications({
          onToken: (token) => {
            // Send to backend for push delivery
            api.post('/auth/push-subscribe', { subscription: { type: 'native', token } }).catch(() => {});
          },
          onNotification: () => {
            // App is open — notification received while in foreground
          },
          onAction: (action) => {
            // User tapped notification — navigate
            const data = action.notification?.data;
            if (data?.url) navigate(data.url);
            else if (data?.upc) navigate(`/product/${data.upc}`);
          }
        });
      } catch {}
    })();

    return () => cleanup.forEach(fn => fn());
  }, []);

  return null; // Lifecycle only, no UI
}

export default function App() {
  return (
    <>
      <NativeLifecycle />
      <ImpersonationBanner />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
      {/* First visit → onboarding. Already onboarded → /scan */}
      <Route path="/" element={<FirstVisitGate />} />

      {/* Public marketing pages — visible without login, standalone layout */}
      <Route path="/features" element={<Features />} />
      {/* /compare renders Landing directly with a scroll target. Tried
          Navigate to="/#compare" before but the hash didn't reliably survive
          the router's path matching. Direct render is bulletproof. */}
      <Route path="/compare" element={<Landing initialScroll="compare" />} />

      {/* Auth pages */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/join/:token" element={<JoinFamily />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Main app layout — scanning works without login */}
      <Route element={<ErrorBoundary><AppLayout /></ErrorBoundary>}>
        {/* FREE: Anyone can scan and view products */}
        <Route path="/scan" element={<Scan />} />
        <Route path="/product/:upc" element={<ProductResult />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/swaps" element={<Swaps />} />
        <Route path="/receipt" element={<AuthGate><ReceiptScan /></AuthGate>} />
        <Route path="/budget" element={<AuthGate><Budget /></AuthGate>} />

        {/* AUTH REQUIRED: Pantry and account features */}
        <Route path="/pantry" element={<AuthGate><Pantry /></AuthGate>} />
        <Route path="/pantry/audit" element={<AuthGate><PremiumGate feature="Pantry health audit"><PantryAudit /></PremiumGate></AuthGate>} />
        <Route path="/pantry/photo-scan" element={<AuthGate><PantryPhotoScan /></AuthGate>} />
        <Route path="/shopping" element={<AuthGate><PremiumGate feature="Smart shopping lists"><Shopping /></PremiumGate></AuthGate>} />
        <Route path="/shopping/:id" element={<AuthGate><PremiumGate feature="Smart shopping lists"><ShoppingList /></PremiumGate></AuthGate>} />
        <Route path="/shopping/:id/mode" element={<AuthGate><PremiumGate feature="Smart shopping lists"><ShoppingMode /></PremiumGate></AuthGate>} />
        <Route path="/progress" element={<AuthGate><Progress /></AuthGate>} />
        <Route path="/profile" element={<AuthGate><Profile /></AuthGate>} />
        <Route path="/subscription" element={<AuthGate><Subscription /></AuthGate>} />
        <Route path="/admin" element={<AuthGate><Admin /></AuthGate>} />
        <Route path="/family" element={<AuthGate><Family /></AuthGate>} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/support" element={<Support />} />
        <Route path="/about-scoring" element={<AboutScoring />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}
