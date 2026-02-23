import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Scan, ArrowRightLeft, ChefHat, Package, User, Settings, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOnline } from '../../hooks/useOnline';
import TrialBanner from './TrialBanner';

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
  const isOnline = useOnline();
  
  const hideNav = location.pathname.includes('/mode');
  const hideTopBar = location.pathname === '/scan' || location.pathname.startsWith('/product/');

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-safe">
      <TrialBanner />

      {/* Offline banner */}
      {!isOnline && (
        <div className="border-b border-yellow-500/30 px-4 py-2 flex items-center gap-2"
             style={{ background: 'rgba(255,214,10,0.06)' }}>
          <WifiOff className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-yellow-300 text-xs" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
            OFFLINE — cached products still available
          </p>
        </div>
      )}

      {/* Top bar */}
      {!hideTopBar && !hideNav && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '2px', color: 'var(--ick-green)' }}>
            ICKTHATISH
          </div>
          {user ? (
            <button
              onClick={() => navigate('/profile')}
              className="p-2 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" style={{ color: 'var(--muted)' }} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1.5 text-xs border transition-colors"
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px', borderColor: 'var(--ick-green)', color: 'var(--ick-green)' }}
            >
              SIGN IN
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
        <nav className="fixed bottom-0 left-0 right-0 pb-safe z-40"
             style={{ background: '#0d0d0d', borderTop: '1px solid var(--border)' }}>
          <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                className="flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[56px] transition-colors"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--ick-green)' : 'var(--muted)',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                      fontWeight: isActive ? 700 : 400,
                    }}>
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
