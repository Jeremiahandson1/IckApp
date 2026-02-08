import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, MapPin, Users, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const toast = useToast();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    zip_code: '',
    household_size: 1,
    has_kids: false,
    kids_ages: [],
    allergen_alerts: []
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  const COMMON_ALLERGENS = [
    'Gluten', 'Milk', 'Eggs', 'Peanuts', 'Tree Nuts',
    'Fish', 'Soybeans', 'Sesame'
  ];

  const handleStep1 = (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setStep(2);
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      await register(formData);
      toast.success('Welcome to Ick!');
      navigate('/scan');
    } catch (error) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 px-6 pt-safe">
      {/* Header */}
      <div className="py-4">
        <button
          onClick={() => step === 1 ? navigate('/') : setStep(1)}
          className="inline-flex items-center gap-2 text-gray-400"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-orange-500/100' : 'bg-gray-700'}`} />
        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-orange-500/100' : 'bg-gray-700'}`} />
      </div>

      {step === 1 ? (
        /* Step 1: Account */
        <div className="pt-4">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Create account</h1>
          <p className="text-gray-400 mb-8">Start your journey to healthier food</p>

          <form onSubmit={handleStep1} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="your@email.com"
                  className="input-field pl-12"
                  autoComplete="email"
                  autoCapitalize="none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  placeholder="Min. 6 characters"
                  className="input-field pl-12 pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full">
              Continue
            </button>
          </form>

          <p className="mt-8 text-center text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-orange-400 font-semibold">Sign in</Link>
          </p>
        </div>
      ) : (
        /* Step 2: Profile */
        <div className="pt-4">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Tell us about you</h1>
          <p className="text-gray-400 mb-8">Help us personalize your experience</p>

          <form onSubmit={handleStep2} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Your name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="How should we call you?"
                  className="input-field pl-12"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">ZIP code</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.zip_code}
                  onChange={(e) => updateField('zip_code', e.target.value.slice(0, 5))}
                  placeholder="For local product availability"
                  className="input-field pl-12"
                  inputMode="numeric"
                  maxLength={5}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Household size</label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={formData.household_size}
                  onChange={(e) => updateField('household_size', parseInt(e.target.value))}
                  className="input-field pl-12 appearance-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-700">
                <input
                  type="checkbox"
                  checked={formData.has_kids}
                  onChange={(e) => updateField('has_kids', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 text-orange-500 focus:ring-orange-500"
                />
                <span className="font-medium text-gray-300">I have kids under 18</span>
              </label>
            </div>

            {formData.has_kids && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Kids' ages</label>
                <input
                  type="text"
                  value={formData.kids_ages.join(', ')}
                  onChange={(e) => {
                    const ages = e.target.value.split(',').map(a => parseInt(a.trim())).filter(a => !isNaN(a));
                    updateField('kids_ages', ages);
                  }}
                  placeholder="e.g., 3, 7, 12"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">Separate ages with commas</p>
              </div>
            )}

            {/* Allergen Alerts */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Any food allergies?</label>
              <p className="text-xs text-gray-500 mb-3">We'll alert you when scanning products with these allergens.</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGENS.map(allergen => {
                  const isSelected = formData.allergen_alerts.includes(allergen);
                  return (
                    <button
                      key={allergen}
                      type="button"
                      onClick={() => toggleAllergen(allergen)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-red-500/100 text-white'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}{allergen}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            You can skip optional fields and update them later
          </p>
        </div>
      )}
    </div>
  );
}
