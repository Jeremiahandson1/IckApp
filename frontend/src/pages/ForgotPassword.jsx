import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSubmitted(true);
    } catch (err) {
      // Still show success to prevent email enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-5xl">🥦</span>
          <h1 className="text-2xl font-bold text-white mt-3">Ick</h1>
        </div>

        {submitted ? (
          <div className="bg-[#111] rounded-sm p-6 text-center space-y-4">
            <div className="text-4xl">📬</div>
            <h2 className="text-xl font-bold text-white">Check your email</h2>
            <p className="text-[#888] text-sm">
              If <span className="text-white">{email}</span> is registered, we sent a reset link. Check your inbox (and spam folder).
            </p>
            <p className="text-[#666] text-xs">The link expires in 1 hour.</p>
            <Link
              to="/login"
              className="block w-full py-3 bg-[#1e1e1e] text-[#bbb] rounded-sm font-medium text-center mt-2"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <div className="bg-[#111] rounded-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white">Forgot your password?</h2>
              <p className="text-[#888] text-sm mt-1">Enter your email and we'll send a reset link.</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#1e1e1e] border border-[#333] rounded-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 bg-[#c8f135] text-white rounded-sm font-semibold text-lg disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="text-center">
              <Link to="/login" className="text-[#888] text-sm hover:text-[#bbb]">
                ← Back to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
