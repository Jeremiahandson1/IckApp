import { useEffect, useState } from 'react';
import { getStoredToken, setStoredToken, removeStoredToken } from '../../utils/tokenStorage';

// Decode JWT payload without verifying — banner is UI-only, the server still
// trusts only its own signature.
function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function ImpersonationBanner() {
  const [imp, setImp] = useState(null);

  useEffect(() => {
    const sync = () => {
      const token = getStoredToken('token');
      const payload = token ? decodeJwt(token) : null;
      setImp(payload?.imp ? payload : null);
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  if (!imp) return null;

  const exit = () => {
    // The parked admin token lives in sessionStorage so it dies with the
    // session instead of persisting on disk. Fall back to localStorage for
    // sessions started on an older build, then scrub it.
    const ret = sessionStorage.getItem('admin_return_token') || localStorage.getItem('admin_return_token');
    sessionStorage.removeItem('admin_return_token');
    localStorage.removeItem('admin_return_token');
    if (ret) {
      setStoredToken('token', ret);
    } else {
      removeStoredToken('token');
    }
    window.location.href = '/admin';
  };

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 9999,
      background: '#c8f135', color: '#0a0a0a',
      padding: '10px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12,
      fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <span>
        Impersonating <strong>{imp.email}</strong> as admin.
      </span>
      <button
        onClick={exit}
        style={{
          background: '#0a0a0a', color: '#c8f135',
          border: 'none', borderRadius: 8, padding: '6px 14px',
          fontWeight: 700, cursor: 'pointer', fontSize: 13,
          fontFamily: 'Space Mono, monospace', letterSpacing: 0.5,
        }}
      >
        ← Return to admin
      </button>
    </div>
  );
}
