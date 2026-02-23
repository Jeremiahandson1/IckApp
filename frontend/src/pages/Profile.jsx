import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { account } from '../utils/api';
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

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (passwordForm.next.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }
    setPasswordSaving(true);
    try {
      await account.changePassword(passwordForm.current, passwordForm.next);
      showToast('Password updated. All other sessions logged out.', 'success');
      setShowPasswordForm(false);
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await account.deleteAccount(deletePassword);
      logout();
      navigate('/');
      showToast('Your account has been deleted.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete account', 'error');
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#c8f135] border-t-transparent rounded-full" />
      </div>
    );
  }

  const allergens = profile?.allergen_alerts || [];

  return (
    <div className="pb-4">
      <h1 className="text-xl font-bold text-[#f4f4f0] mb-4">Profile</h1>

      {/* Profile Card */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-[rgba(200,241,53,0.1)] flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <h2 className="font-semibold text-[#f4f4f0]">{profile?.name || 'User'}</h2>
            <p className="text-sm text-[#666]">{profile?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-[#2a2a2a]">
          <div className="text-center">
            <div className="text-xl font-bold text-[#f4f4f0]">
              {profile?.total_products_scanned || 0}
            </div>
            <div className="text-xs text-[#666]">Scans</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#c8f135]">
              {profile?.total_swaps_clicked || 0}
            </div>
            <div className="text-xs text-[#666]">Swaps</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-amber-500">
              {profile?.total_recipes_viewed || 0}
            </div>
            <div className="text-xs text-[#666]">Recipes</div>
          </div>
        </div>

        <button
          onClick={() => setEditing(true)}
          className="w-full mt-4 py-2 text-[#c8f135] font-medium"
        >
          Edit Profile
        </button>
      </div>

      {/* Allergen Alerts */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#f4f4f0]">Allergen Alerts</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-[#c8f135] font-medium"
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
          <p className="text-sm text-[#666]">
            No allergens set. Tap Edit to add allergen alerts so we can warn you when scanning products.
          </p>
        )}
      </div>

      {/* Household Settings */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <h3 className="font-semibold text-[#f4f4f0] mb-3">Household Info</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[#666]">Location</span>
            <span className="text-[#f4f4f0]">{profile?.zip_code || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#666]">Household Size</span>
            <span className="text-[#f4f4f0]">{profile?.household_size || 2} people</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#666]">Kids</span>
            <span className="text-[#f4f4f0]">
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
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4"
        onClick={() => navigate('/subscription')}
        role="button"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#f4f4f0]">Subscription</h3>
            <p className="text-sm text-[#666] mt-0.5">
              {profile?.subscription?.isPremium 
                ? profile.subscription.isTrialing 
                  ? `Trial — ${profile.subscription.daysLeft} days left`
                  : `${profile.subscription.plan} plan`
                : 'Free plan'}
            </p>
          </div>
          <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* App Settings */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <h3 className="font-semibold text-[#f4f4f0] mb-3">App Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between opacity-60">
            <div>
              <p className="font-medium text-[#f4f4f0]">Push Notifications</p>
              <p className="text-xs text-[#666]">Coming soon</p>
            </div>
            <div className="w-12 h-6 bg-gray-300 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-[#0d0d0d] rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between opacity-60">
            <div>
              <p className="font-medium text-[#f4f4f0]">Velocity Tracking</p>
              <p className="text-xs text-[#666]">Coming soon</p>
            </div>
            <div className="w-12 h-6 bg-gray-300 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-[#0d0d0d] rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <h3 className="font-semibold text-[#f4f4f0] mb-3">Data & Privacy</h3>
        <div className="space-y-3">
          <button className="w-full text-left py-2 text-[#bbb] flex items-center justify-between">
            <span>Export My Data</span>
            <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="w-full text-left py-2 text-[#bbb] flex items-center justify-between">
            <span>Privacy Policy</span>
            <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="bg-[#0d0d0d] rounded-sm p-4 mb-4">
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
            <p className="font-medium text-[#f4f4f0]">Push Notifications</p>
            <p className="text-xs text-[#666]">Get alerts for score changes and new swaps</p>
          </div>
          <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
      </div>

      {/* Admin Panel Link (only for admins) */}
      {user?.is_admin && (
        <button
          onClick={() => navigate('/admin')}
          className="w-full py-3 bg-[rgba(200,241,53,0.06)] border border-[#c8f135]/30 text-[#c8f135] rounded-sm font-medium flex items-center justify-center gap-2"
        >
          <span>⚙️</span> Admin Panel
        </button>
      )}

      {/* Account Security */}
      <div className="bg-[#111] rounded-sm p-4 space-y-3">
        <h3 className="text-sm font-medium text-[#888] uppercase tracking-wide">Account</h3>
        <button
          onClick={() => setShowPasswordForm(true)}
          className="w-full py-3 bg-[#1e1e1e] text-[#bbb] rounded-sm font-medium text-left px-4 flex items-center justify-between"
        >
          <span>Change Password</span>
          <svg className="w-4 h-4 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3 bg-[#1e1e1e] text-red-400 rounded-sm font-medium text-left px-4"
        >
          Delete Account
        </button>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-[#1e1e1e] text-[#bbb] rounded-sm font-medium"
      >
        Log Out
      </button>

      <p className="text-center text-xs text-[#888] mt-4">
        Ick v2.0.0
      </p>

      {/* Change Password Modal */}
      {showPasswordForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d0d0d] rounded-sm p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#111] border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordForm.next}
                  onChange={e => setPasswordForm(p => ({ ...p, next: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#111] border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#111] border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPasswordForm(false); setPasswordForm({ current: '', next: '', confirm: '' }); }}
                  className="flex-1 py-3 bg-[#1e1e1e] text-[#888] rounded-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="flex-1 py-3 bg-[#c8f135] text-white rounded-sm font-medium disabled:opacity-50"
                >
                  {passwordSaving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d0d0d] rounded-sm p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-red-400 mb-2">Delete Account</h2>
            <p className="text-sm text-[#888] mb-4">
              This permanently deletes your account, pantry, scan history, and all data. This cannot be undone.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-1">Enter your password to confirm</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#111] border border-red-800 rounded-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Your password"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                  className="flex-1 py-3 bg-[#1e1e1e] text-[#888] rounded-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-sm font-medium disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d0d0d] rounded-sm p-6 w-full max-w-sm max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={formData.zip_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                  maxLength={5}
                  className="w-full px-4 py-3 border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-1">Household Size</label>
                <select
                  value={formData.household_size}
                  onChange={(e) => setFormData(prev => ({ ...prev, household_size: e.target.value }))}
                  className="w-full px-4 py-3 border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
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
                  className="w-5 h-5 rounded border-[#444] text-[#c8f135] focus:ring-[#c8f135]"
                />
                <label htmlFor="hasKids" className="text-[#bbb]">I have kids</label>
              </div>

              {formData.has_kids && (
                <div>
                  <label className="block text-sm font-medium text-[#bbb] mb-1">
                    Kids' Ages (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.kids_ages}
                    onChange={(e) => setFormData(prev => ({ ...prev, kids_ages: e.target.value }))}
                    placeholder="e.g., 3, 7, 12"
                    className="w-full px-4 py-3 border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                  />
                </div>
              )}

              {/* Allergen Alerts */}
              <div>
                <label className="block text-sm font-medium text-[#bbb] mb-2">
                  Allergen Alerts
                </label>
                <p className="text-xs text-[#666] mb-3">
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
                            : 'bg-[#1e1e1e] text-[#888] hover:bg-[#2a2a2a]'
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
                  className="flex-1 py-3 bg-[#1e1e1e] text-[#888] rounded-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-[rgba(200,241,53,0.06)] text-white rounded-sm font-medium disabled:opacity-50"
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
