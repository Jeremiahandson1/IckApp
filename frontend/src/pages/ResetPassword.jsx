import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }
    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: form.password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">🥦</span>
          <h1 className="text-2xl font-bold text-white mt-3">Ick</h1>
        </div>

        {done ? (
          <div className="bg-gray-900 rounded-2xl p-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-bold text-white">Password reset!</h2>
            <p className="text-gray-400 text-sm">You're being redirected to login…</p>
            <Link to="/login" className="block w-full py-3 bg-orange-500 text-white rounded-xl font-semibold">
              Go to Login
            </Link>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white">Set new password</h2>
              <p className="text-gray-400 text-sm mt-1">Choose a strong password for your account.</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
                {error.includes('expired') && (
                  <div className="mt-2">
                    <Link to="/forgot-password" className="text-orange-400 underline">Request a new link →</Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  autoFocus
                  disabled={!token}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Same password again"
                  required
                  disabled={!token}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !token || !form.password || !form.confirm}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold text-lg disabled:opacity-50"
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>

            <div className="text-center">
              <Link to="/login" className="text-gray-400 text-sm hover:text-gray-300">← Back to Login</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
