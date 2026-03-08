import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Crown } from 'lucide-react';
import api from '../../utils/api';

export default function PremiumGate({ feature, children }) {
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    checkPremiumStatus();
  }, []);

  const checkPremiumStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const data = await api.get('/subscription/status');
      // Backend returns is_premium: true when PREMIUM_ENABLED=false (gate off)
      // Also returns premium_gate_off: true as an explicit signal
      setIsPremium(data.is_premium || data.premium_gate_off || false);
    } catch {
      // If check fails, deny access (fail closed) — user can retry
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    setStarting(true);
    try {
      const data = await api.post('/subscription/start-trial');

      if (data.subscription) {
        await refreshProfile();
        setIsPremium(true);
      } else if (data.error === 'Trial already used') {
        navigate('/subscription');
      }
    } catch {
      navigate('/subscription');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c8f135]" />
      </div>
    );
  }

  if (isPremium) {
    return children;
  }

  // Not premium — show gate
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="bg-[#1e1e1e]/50 rounded-sm p-3 mb-4">
        <Lock className="w-8 h-8 text-[#888]" />
      </div>
      <h2 className="text-xl font-bold text-[#f4f4f0] mb-2">Premium Feature</h2>
      <p className="text-[#888] text-center mb-6 max-w-sm">
        {feature} requires a premium subscription.
        <br />Start your free 30-day trial to unlock everything.
      </p>
      <button
        onClick={handleStartTrial}
        disabled={starting}
        className="flex items-center gap-2 bg-[#c8f135] hover:bg-[#b5d930] text-[#0d0d0d] font-semibold px-8 py-3 rounded-sm transition-colors w-full max-w-xs justify-center disabled:opacity-50"
      >
        {starting ? (
          <div className="w-5 h-5 border-2 border-[#0d0d0d] border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Crown className="w-5 h-5" />
            Start Free 30-Day Trial
          </>
        )}
      </button>
    </div>
  );
}
