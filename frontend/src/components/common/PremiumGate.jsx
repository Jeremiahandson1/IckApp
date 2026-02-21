import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function PremiumGate({ feature, children }) {
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const navigate = useNavigate();

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

      const res = await fetch(`${API_URL}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        // Backend returns is_premium: true when PREMIUM_ENABLED=false (gate off)
        // Also returns premium_gate_off: true as an explicit signal
        setIsPremium(data.is_premium || data.premium_gate_off || false);
      }
    } catch (err) {
      // If check fails, be permissive (fail open)
      console.error('Premium check error:', err);
      setIsPremium(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/subscription/start-trial`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        setIsPremium(true);
      } else {
        const data = await res.json();
        if (data.error === 'Trial already used') {
          navigate('/subscription');
        }
      }
    } catch (err) {
      console.error('Start trial error:', err);
      navigate('/subscription');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (isPremium) {
    return children;
  }

  // Not premium — show gate
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="bg-gray-800/50 rounded-2xl p-3 mb-4">
        <Lock className="w-8 h-8 text-gray-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-100 mb-2">Premium Feature</h2>
      <p className="text-gray-400 text-center mb-6 max-w-sm">
        {feature} requires a premium subscription.
        <br />Start your free 30-day trial to unlock everything.
      </p>
      <button
        onClick={handleStartTrial}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors w-full max-w-xs justify-center"
      >
        <Crown className="w-5 h-5" />
        Start Free Trial
      </button>
    </div>
  );
}
