import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const COMMON_ALLERGENS = [
  'Gluten', 'Milk', 'Eggs', 'Fish', 'Crustaceans',
  'Tree Nuts', 'Peanuts', 'Soybeans', 'Sesame', 'Celery',
  'Mustard', 'Sulfites', 'Lupin', 'Molluscs'
];

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      const userData = res.user;
      setProfile(userData);
      setFormData({
        name: userData.name || '',
        zip_code: userData.zip_code || '',
        household_size: userData.household_size || 2,
        has_kids: userData.has_kids || false,
        kids_ages: userData.kids_ages?.join(', ') || '',
        allergen_alerts: userData.allergen_alerts || []
      });
    } catch (err) {
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        household_size: parseInt(formData.household_size) || 2,
        kids_ages: formData.kids_ages 
          ? formData.kids_ages.split(',').map(a => parseInt(a.trim())).filter(a => !isNaN(a))
          : [],
        allergen_alerts: formData.allergen_alerts
      };
      
      await api.put('/auth/profile', payload);
      showToast('Profile updated!', 'success');
      setEditing(false);
      loadProfile();
    } catch (err) {
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAllergen = (allergen) => {
    setFormData(prev => {
      const current = prev.allergen_alerts || [];
      const updated = current.includes(allergen)
        ? current.filter(a => a !== allergen)
        : [...current, allergen];
      return { ...prev, allergen_alerts: updated };
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const allergens = profile?.allergen_alerts || [];

  return (
    <div className="pb-4">
      <h1 className="text-xl font-bold text-gray-100 mb-4">Profile</h1>

      {/* Profile Card */}
      <div className="bg-gray-950 rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-100">{profile?.name || 'User'}</h2>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-gray-800">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-100">
              {profile?.total_products_scanned || 0}
            </div>
            <div className="text-xs text-gray-500">Scans</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-orange-500">
              {profile?.total_swaps_clicked || 0}
            </div>
            <div className="text-xs text-gray-500">Swaps</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-amber-500">
              {profile?.total_recipes_viewed || 0}
            </div>
            <div className="text-xs text-gray-500">Recipes</div>
          </div>
        </div>

        <button
          onClick={() => setEditing(true)}
          className="w-full mt-4 py-2 text-orange-400 font-medium"
        >
          Edit Profile
        </button>
      </div>

      {/* Allergen Alerts */}
      <div className="bg-gray-950 rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-100">Allergen Alerts</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-orange-400 font-medium"
          >
            Edit
          </button>
        </div>
        {allergens.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allergens.map(a => (
              <span key={a} className="px-3 py-1 bg-red-500/10 text-red-700 rounded-full text-sm font-medium">
                ⚠️ {a}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No allergens set. Tap Edit to add allergen alerts so we can warn you when scanning products.
          </p>
        )}
      </div>

      {/* Household Settings */}
      <div className="bg-gray-950 rounded-xl p-4 shadow-sm mb-4">
        <h3 className="font-semibold text-gray-100 mb-3">Household Info</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Location</span>
            <span className="text-gray-100">{profile?.zip_code || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Household Size</span>
            <span className="text-gray-100">{profile?.household_size || 2} people</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Kids</span>
            <span className="text-gray-100">
              {profile?.has_kids 
                ? profile?.kids_ages?.length 
                  ? `Ages: ${profile.kids_ages.join(', ')}`
                  : 'Yes'
                : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-gray-950 rounded-xl p-4 shadow-sm mb-4"
        onClick={() => navigate('/subscription')}
        role="button"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-100">Subscription</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {profile?.subscription?.isPremium 
                ? profile.subscription.isTrialing 
                  ? `Trial — ${profile.subscription.daysLeft} days left`
                  : `${profile.subscription.plan} plan`
                : 'Free plan'}
            </p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* App Settings */}
      <div className="bg-gray-950 rounded-xl p-4 shadow-sm mb-4">
        <h3 className="font-semibold text-gray-100 mb-3">App Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between opacity-60">
            <div>
              <p className="font-medium text-gray-100">Push Notifications</p>
              <p className="text-xs text-gray-500">Coming soon</p>
            </div>
            <div className="w-12 h-6 bg-gray-300 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-gray-950 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between opacity-60">
            <div>
              <p className="font-medium text-gray-100">Velocity Tracking</p>
              <p className="text-xs text-gray-500">Coming soon</p>
            </div>
            <div className="w-12 h-6 bg-gray-300 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-gray-950 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-gray-950 rounded-xl p-4 shadow-sm mb-4">
        <h3 className="font-semibold text-gray-100 mb-3">Data & Privacy</h3>
        <div className="space-y-3">
          <button className="w-full text-left py-2 text-gray-300 flex items-center justify-between">
            <span>Export My Data</span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="w-full text-left py-2 text-gray-300 flex items-center justify-between">
            <span>Privacy Policy</span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="w-full text-left py-2 text-red-500 flex items-center justify-between">
            <span>Delete Account</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-gray-950 rounded-2xl p-4 mb-4">
        <button
          onClick={async () => {
            if (!('Notification' in window)) {
              showToast('Notifications not supported on this device', 'info');
              return;
            }
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY || undefined
                });
                await api.post('/auth/push-subscribe', { subscription: sub.toJSON() });
                showToast('Notifications enabled!', 'success');
              } catch (e) {
                showToast('Notification setup not available yet', 'info');
              }
            } else {
              showToast('Notification permission denied', 'info');
            }
          }}
          className="w-full flex items-center justify-between py-2"
        >
          <div>
            <p className="font-medium text-gray-100">Push Notifications</p>
            <p className="text-xs text-gray-500">Get alerts for score changes and new swaps</p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-gray-800 text-gray-300 rounded-xl font-medium"
      >
        Log Out
      </button>

      <p className="text-center text-xs text-gray-400 mt-4">
        Ick v2.0.0
      </p>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-950 rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={formData.zip_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                  maxLength={5}
                  className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Household Size</label>
                <select
                  value={formData.household_size}
                  onChange={(e) => setFormData(prev => ({ ...prev, household_size: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hasKids"
                  checked={formData.has_kids}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_kids: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-600 text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="hasKids" className="text-gray-300">I have kids</label>
              </div>

              {formData.has_kids && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Kids' Ages (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.kids_ages}
                    onChange={(e) => setFormData(prev => ({ ...prev, kids_ages: e.target.value }))}
                    placeholder="e.g., 3, 7, 12"
                    className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}

              {/* Allergen Alerts */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Allergen Alerts
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  We'll warn you when scanned products contain these allergens.
                </p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_ALLERGENS.map(allergen => {
                    const isSelected = (formData.allergen_alerts || []).includes(allergen);
                    return (
                      <button
                        key={allergen}
                        type="button"
                        onClick={() => toggleAllergen(allergen)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-red-500/100 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {isSelected ? '✓ ' : ''}{allergen}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-orange-500/100 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
