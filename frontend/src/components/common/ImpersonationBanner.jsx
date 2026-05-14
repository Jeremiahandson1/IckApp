import { useEffect, useState } from 'react';

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
      const token = localStorage.getItem('token');
      const payload = token ? decodeJwt(token) : null;
      setImp(payload?.imp ? payload : null);
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  if (!imp) return null;

  const exit = () => {
    const ret = localStorage.getItem('admin_return_token');
    if (ret) {
      localStorage.setItem('token', ret);
      localStorage.removeItem('admin_return_token');
    } else {
      localStorage.removeItem('token');
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
