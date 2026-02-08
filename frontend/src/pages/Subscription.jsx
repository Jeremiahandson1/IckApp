import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { subscription } from '../utils/api';
import api from '../utils/api';
import { 
  Shield, Zap, ChefHat, TrendingUp, ShoppingCart, Target, 
  Check, Crown, AlertTriangle, Globe, ArrowRight
} from 'lucide-react';

export default function Subscription() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [scanStats, setScanStats] = useState(null);

  useEffect(() => {
    // Handle Stripe return
    if (searchParams.get('success') === 'true') {
      toast.success('Payment successful! Welcome to Premium.');
      refreshProfile();
    }
    if (searchParams.get('cancelled') === 'true') {
      toast.info('Checkout cancelled — no charges made.');
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const statusData = await subscription.status();
      setSub(statusData);
      try {
        const dashData = await api.get('/progress/dashboard');
        setScanStats(dashData.data || dashData);
      } catch (e) {}
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    setStarting(true);
    try {
      const result = await subscription.startTrial();
      toast.success('Your 30-day free trial has started!');
      setSub(result.subscription);
      await refreshProfile();
    } catch (err) {
      toast.error(err.data?.message || err.data?.error || 'Failed to start trial');
    } finally {
      setStarting(false);
    }
  };

  const handleSubscribe = async (plan) => {
    setSubscribing(plan);
    try {
      const result = await subscription.subscribe(plan);
      
      // If Stripe is configured, we get a checkout URL — redirect there
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      
      // Stripe not configured — show setup message
      if (result.error) {
        toast.error(result.message || result.error);
        return;
      }

      // Fallback
      toast.success(`Subscribed to ${plan} plan!`);
      setSub(result.subscription);
      await refreshProfile();
    } catch (err) {
      const msg = err?.data?.message || err?.data?.error || 'Failed to subscribe';
      toast.error(msg);
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  // Already premium
  if (sub?.isPremium) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="bg-gradient-to-br from-orange-50 to-teal-50 rounded-2xl p-6 text-center">
          <Crown className="w-12 h-12 text-orange-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-100">
            {sub.isTrialing ? 'Free Trial Active' : 'Premium Member'}
          </h2>
          {sub.isTrialing && (
            <p className="text-orange-400 font-medium mt-1">
              {sub.daysLeft} day{sub.daysLeft !== 1 ? 's' : ''} remaining
            </p>
          )}
          <p className="text-gray-400 mt-2">Full access to all features.</p>
        </div>

        {sub.isTrialing && (
          <div className="bg-gray-950 rounded-2xl p-6 border border-gray-700 space-y-4">
            <h3 className="font-semibold text-gray-100">Keep it going?</h3>
            <p className="text-sm text-gray-400">Lock in your price before the trial ends:</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleSubscribe('monthly')}
                disabled={subscribing === 'monthly'}
                className="p-4 border-2 border-gray-700 rounded-xl text-center hover:border-orange-300 transition-colors disabled:opacity-50">
                {subscribing === 'monthly' ? (
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto my-2" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-100">$3.99</p>
                    <p className="text-sm text-gray-500">per month</p>
                  </>
                )}
              </button>
              <button onClick={() => handleSubscribe('yearly')}
                disabled={subscribing === 'yearly'}
                className="p-4 border-2 border-orange-500 rounded-xl text-center bg-orange-500/10 relative disabled:opacity-50">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-bold bg-orange-500/100 text-white px-2 py-0.5 rounded-full">
                  SAVE 37%
                </span>
                <p className="text-2xl font-bold text-orange-400">$29.99</p>
                <p className="text-sm text-orange-400">per year</p>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Free / expired — pitch page
  const scansCount = scanStats?.total_products_scanned || 0;
  const hasScanned = scansCount > 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      
      {/* Headline — personalized if they've used the app */}
      <div className="text-center space-y-3 pt-2">
        {hasScanned ? (
          <>
            <h1 className="text-2xl font-bold text-gray-100">
              You've scanned {scansCount} product{scansCount !== 1 ? 's' : ''}.
            </h1>
            <p className="text-gray-400">
              Unlock the full story on every one — who put those ingredients there, why, and what to do about it.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-100">
              What's really in your kid's food?
            </h1>
            <p className="text-gray-400">
              Not just a score. The full picture — harmful ingredients, where they're banned, who profits, and healthier alternatives.
            </p>
          </>
        )}
      </div>

      {/* Visceral fact cards */}
      <div className="bg-red-500/10 border border-red-100 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300">
            <strong>Red 40</strong> is in 40% of US kids' snacks. It requires a 
            <strong className="text-red-400"> cancer warning label</strong> in the EU. Companies use it because it costs $3/kg vs $30/kg for natural alternatives.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300">
            <strong>Potassium bromate</strong> is banned in the EU, Canada, Brazil, China, India, Japan, and South Korea. 
            It's still in US bread. Ick shows you which products contain it.
          </p>
        </div>
      </div>

      {/* What you get */}
      <div className="bg-gray-950 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-800 bg-gray-900">
          <h3 className="font-semibold text-gray-100">Free forever</h3>
        </div>
        <div className="p-4 space-y-2">
          {['Unlimited scanning', 'Health scores & verdicts', 'Ingredient warnings', 'Allergen alerts', 'Swap suggestions', 'Favorites & scan history'].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
              <Check className="w-4 h-4 text-orange-500 flex-shrink-0" /> {item}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 bg-orange-500/10/50">
          <h3 className="font-semibold text-orange-700">Premium unlocks</h3>
        </div>
        <div className="p-4 space-y-3">
          {[
            { icon: Zap, text: 'Pantry management', desc: 'Track everything in your kitchen, get health audit' },
            { icon: Shield, text: 'Velocity tracking', desc: 'Know when you\'ll run out — avoid emergency junk food buys' },
            { icon: ChefHat, text: 'Full recipe library', desc: 'Homemade versions of processed foods your family loves' },
            { icon: ShoppingCart, text: 'Smart shopping lists', desc: 'Auto-generated from what you\'re running low on' },
            { icon: TrendingUp, text: 'Progress analytics', desc: 'Detailed health trends, achievements, and family reports' },
            { icon: Target, text: 'Family profiles', desc: 'Track allergens and dietary preferences for each family member' },
          ].map(({ icon: Icon, text, desc }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-100">{text}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-orange-500 to-teal-600 rounded-2xl p-6 text-center text-white space-y-4">
        <h2 className="text-xl font-bold">Try everything free for 30 days</h2>
        <p className="text-orange-100 text-sm">No credit card. Cancel anytime.</p>
        
        <button
          onClick={handleStartTrial}
          disabled={starting}
          className="w-full py-3.5 bg-gray-950 text-orange-400 rounded-xl font-bold text-lg hover:bg-orange-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {starting ? (
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>Start Free Trial <ArrowRight className="w-5 h-5" /></>
          )}
        </button>

        <div className="flex justify-center gap-6 text-orange-200 text-xs">
          <span>Then $3.99/mo</span>
          <span>or $29.99/yr (save 37%)</span>
        </div>
      </div>

      {/* Trust */}
      <div className="text-center text-xs text-gray-400 space-y-1 pb-4">
        <p className="font-medium text-gray-500">Our promise</p>
        <p>No ads. No affiliate links. No sponsored recommendations.</p>
        <p>Every score is independent. We make money from subscriptions, not from selling you products.</p>
      </div>
    </div>
  );
}
