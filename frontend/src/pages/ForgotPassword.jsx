import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import api from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

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
    <div className="min-h-screen bg-[#0a0a0a] px-6 pt-safe">
      {/* Header */}
      <div className="py-4 flex items-center justify-between">
        <Link to="/login" className="inline-flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <ArrowLeft className="w-5 h-5" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>Back</span>
        </Link>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '2px', color: 'var(--ick-green)' }}>ICKTHATISH</span>
      </div>

      {submitted ? (
        <div className="pt-8">
          <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: '52px', letterSpacing: '2px', lineHeight: '1', color: '#f4f4f0' }}>CHECK<br/><span style={{ color: 'var(--ick-green)' }}>YOUR EMAIL.</span></h1>
          <p className="mb-6" style={{ color: 'var(--muted)', fontWeight: 300, fontSize: '15px' }}>
            If <span className="text-[#f4f4f0] font-medium">{email}</span> is registered, we sent a reset link. Check your inbox (and spam folder).
          </p>
          <p className="text-xs mb-8" style={{ color: '#555' }}>The link expires in 1 hour.</p>
          <Link
            to="/login"
            className="btn-primary w-full flex items-center justify-center"
          >
            Back to Login
          </Link>
        </div>
      ) : (
        <div className="pt-8">
          <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: '52px', letterSpacing: '2px', lineHeight: '1', color: '#f4f4f0' }}>FORGOT<br/><span style={{ color: 'var(--ick-green)' }}>PASSWORD?</span></h1>
          <p className="mb-8" style={{ color: 'var(--muted)', fontWeight: 300, fontSize: '15px' }}>Enter your email and we'll send a reset link.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#bbb] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888]" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field pl-12"
                  placeholder="your@email.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[#888]">
            Remember your password?{' '}
            <Link to="/login" className="text-[#c8f135] font-semibold">Sign in</Link>
          </p>
        </div>
      )}
    </div>
  );
}
