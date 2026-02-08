import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Crown, Lock } from 'lucide-react';

/**
 * Wraps premium-only pages. Checks if user has premium access
 * and redirects to /subscription if not.
 */
export default function PremiumGate({ children, feature = 'this feature' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (user) {
      const sub = user.subscription;
      if (sub && sub.isPremium) {
        setChecked(true);
      } else {
        // Not premium — show gate briefly then redirect
        setChecked(true);
      }
    }
  }, [user]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const sub = user?.subscription;
  if (!sub?.isPremium) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-100">Premium Feature</h2>
        <p className="text-gray-400">
          {feature} requires a premium subscription. Start your free 30-day trial to unlock everything.
        </p>
        <button
          onClick={() => navigate('/subscription')}
          className="w-full py-3 bg-orange-500/100 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
        >
          <Crown className="w-5 h-5 inline mr-2" />
          Start Free Trial
        </button>
      </div>
    );
  }

  return children;
}
