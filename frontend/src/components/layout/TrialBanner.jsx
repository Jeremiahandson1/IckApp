import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Crown, Clock } from 'lucide-react';

export default function TrialBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const sub = user?.subscription;

  if (!sub) return null;

  // Trial active — show days remaining
  if (sub.isTrialing && sub.daysLeft > 0) {
    const urgent = sub.daysLeft <= 7;
    return (
      <div
        onClick={() => navigate('/subscription')}
        className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer transition-colors ${
          urgent
            ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20'
            : 'bg-orange-500/10 text-orange-700 hover:bg-orange-500/20'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>
          {sub.daysLeft} day{sub.daysLeft !== 1 ? 's' : ''} left in your free trial
          {urgent ? ' — subscribe to keep all features' : ''}
        </span>
      </div>
    );
  }

  // Trial expired, not subscribed
  if (sub.status === 'trial_expired' && !sub.isPremium) {
    return (
      <div
        onClick={() => navigate('/subscription')}
        className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer bg-red-500/10 text-red-700 hover:bg-red-500/20 transition-colors"
      >
        <Crown className="w-3.5 h-3.5" />
        <span>Your trial has ended — subscribe to keep premium features</span>
      </div>
    );
  }

  // Free user, never trialed
  if (sub.plan === 'free' && !sub.isTrialing) {
    return (
      <div
        onClick={() => navigate('/subscription')}
        className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 transition-colors"
      >
        <Crown className="w-3.5 h-3.5" />
        <span>Try Premium free for 30 days — unlock pantry tracking, recipes, and more</span>
      </div>
    );
  }

  return null;
}
