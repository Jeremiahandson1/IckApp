import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error

  useEffect(() => {
    if (!token) { setStatus('error'); return; }

    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <span className="text-5xl block">🥦</span>

        {status === 'verifying' && (
          <>
            <div className="animate-spin w-10 h-10 border-4 border-[#c8f135] border-t-transparent rounded-full mx-auto" />
            <p className="text-[#888]">Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <div className="bg-[#111] rounded-sm p-6 space-y-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-bold text-white">Email verified!</h2>
            <p className="text-[#888] text-sm">Your email is confirmed. You're all set.</p>
            <Link to="/scan" className="block w-full py-3 bg-[#c8f135] text-white rounded-sm font-semibold">
              Start Scanning →
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-[#111] rounded-sm p-6 space-y-4">
            <div className="text-4xl">❌</div>
            <h2 className="text-xl font-bold text-white">Verification failed</h2>
            <p className="text-[#888] text-sm">
              This link is invalid or has already been used. If your email is already verified, you're good to go.
            </p>
            <Link to="/scan" className="block w-full py-3 bg-[#c8f135] text-white rounded-sm font-semibold">
              Go to App
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
