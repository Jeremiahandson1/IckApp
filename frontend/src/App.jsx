import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { isNative } from './utils/platform';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Scan from './pages/Scan';
import ProductResult from './pages/ProductResult';
import Pantry from './pages/Pantry';
import PantryAudit from './pages/PantryAudit';
import Swaps from './pages/Swaps';
import Recipes from './pages/Recipes';
import RecipeDetail from './pages/RecipeDetail';
import Shopping from './pages/Shopping';
import ShoppingList from './pages/ShoppingList';
import ShoppingMode from './pages/ShoppingMode';
import Progress from './pages/Progress';
import Profile from './pages/Profile';
import Subscription from './pages/Subscription';
import PremiumGate from './components/common/PremiumGate';
import ReceiptScan from './pages/ReceiptScan';
import Budget from './pages/Budget';
import Admin from './pages/Admin';

// Auth gate — only for features that truly need login
function AuthGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
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
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (user) return <Navigate to="/scan" replace />;
  return children;
}

// First-time visitor check
function FirstVisitGate() {
  const onboarded = localStorage.getItem('ick_onboarded');
  if (!onboarded) return <Onboarding />;
  return <Navigate to="/scan" replace />;
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
        const api = (await import('./utils/api')).default;
        await initPushNotifications({
          onToken: (token) => {
            // Send to backend for push delivery
            api.post('/auth/push-subscribe', { subscription: { type: 'native', token } }).catch(() => {});
          },
          onNotification: (notification) => {
            // App is open — could show in-app toast
            console.log('[App] Push while open:', notification);
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
      <Routes>
      {/* First visit → onboarding. Already onboarded → /scan */}
      <Route path="/" element={<FirstVisitGate />} />

      {/* Auth pages */}
      <Route path="/landing" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Main app layout — scanning works without login */}
      <Route element={<AppLayout />}>
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
        <Route path="/shopping" element={<AuthGate><PremiumGate feature="Smart shopping lists"><Shopping /></PremiumGate></AuthGate>} />
        <Route path="/shopping/:id" element={<AuthGate><PremiumGate feature="Smart shopping lists"><ShoppingList /></PremiumGate></AuthGate>} />
        <Route path="/shopping/:id/mode" element={<AuthGate><PremiumGate feature="Smart shopping lists"><ShoppingMode /></PremiumGate></AuthGate>} />
        <Route path="/progress" element={<AuthGate><Progress /></AuthGate>} />
        <Route path="/profile" element={<AuthGate><Profile /></AuthGate>} />
        <Route path="/subscription" element={<AuthGate><Subscription /></AuthGate>} />
        <Route path="/admin" element={<AuthGate><Admin /></AuthGate>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
