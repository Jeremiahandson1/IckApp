import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Scan, ArrowRightLeft, ChefHat, Package, User, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import TrialBanner from './TrialBanner';

// Nav restructured for day-1 usefulness:
// Scan (always works) | Swaps (scan-history based) | Recipes (always has content) | Pantry (auth) | Profile
const navItems = [
  { path: '/scan', icon: Scan, label: 'Scan' },
  { path: '/swaps', icon: ArrowRightLeft, label: 'Swaps' },
  { path: '/recipes', icon: ChefHat, label: 'Recipes' },
  { path: '/pantry', icon: Package, label: 'Pantry' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const hideNav = location.pathname.includes('/mode');
  const hideTopBar = location.pathname === '/scan' || location.pathname.startsWith('/product/');

  return (
    <div className="min-h-screen bg-gray-900 pb-safe">
      <TrialBanner />

      {/* Top bar with settings/login */}
      {!hideTopBar && !hideNav && (
        <div className="flex items-center justify-end px-4 pt-3 pb-1">
          {user ? (
            <button
              onClick={() => navigate('/profile')}
              className="p-2 rounded-full hover:bg-gray-800 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1.5 text-sm font-medium text-orange-500 bg-orange-500/100/10 rounded-lg"
            >
              Sign in
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <main className={hideNav ? '' : 'pb-20'}>
        <Outlet />
      </main>

      {/* Bottom navigation */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-700 pb-safe z-40">
          <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => `
                  flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[56px]
                  transition-colors
                  ${isActive ? 'text-orange-500' : 'text-gray-400'}
                `}
              >
                {({ isActive }) => (
                  <>
                    <Icon 
                      className="w-6 h-6" 
                      strokeWidth={isActive ? 2.5 : 2} 
                    />
                    <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
