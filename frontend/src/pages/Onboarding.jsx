import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, ShieldCheck, ArrowRightLeft, ChevronRight, AlertTriangle } from 'lucide-react';

const INFO_SCREENS = [
  {
    icon: Scan,
    color: 'from-orange-500 to-red-500',
    title: 'Scan it',
    subtitle: 'Point at any barcode. Takes one second.',
    detail: 'Instant health score. Nutri-Score science, additive analysis, and organic data. No signup needed.',
  },
  {
    icon: ShieldCheck,
    color: 'from-orange-400 to-amber-500',
    title: 'Ick it',
    subtitle: 'See what they\'re hiding behind the marketing',
    detail: 'Red 40? TBHQ? Sodium nitrite? We flag every harmful additive with severity ratings and scientific sources.',
  },
  {
    icon: ArrowRightLeft,
    color: 'from-amber-500 to-orange-600',
    title: 'Swap it',
    subtitle: 'We don\'t just scare you. We tell you what to buy instead.',
    detail: 'Scan Doritos → see Late July. Scan Kraft Mac & Cheese → see Annie\'s. Real alternatives at your store.',
  }
];

const COMMON_ALLERGENS = [
  { id: 'milk', label: 'Milk', emoji: '🥛' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚' },
  { id: 'peanuts', label: 'Peanuts', emoji: '🥜' },
  { id: 'tree nuts', label: 'Tree Nuts', emoji: '🌰' },
  { id: 'wheat', label: 'Wheat', emoji: '🌾' },
  { id: 'soy', label: 'Soy', emoji: '🫘' },
  { id: 'fish', label: 'Fish', emoji: '🐟' },
  { id: 'shellfish', label: 'Shellfish', emoji: '🦐' },
  { id: 'sesame', label: 'Sesame', emoji: '🫓' },
];

export default function Onboarding() {
  const [screen, setScreen] = useState(0);
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const navigate = useNavigate();

  const totalScreens = INFO_SCREENS.length + 1; // +1 for allergen screen
  const isAllergenScreen = screen === INFO_SCREENS.length;
  const isLast = screen === totalScreens - 1;

  const finish = () => {
    localStorage.setItem('ick_onboarded', 'true');
    // Save allergens to localStorage for anonymous users
    if (selectedAllergens.length > 0) {
      localStorage.setItem('ick_allergens', JSON.stringify(selectedAllergens));
    }
    navigate('/scan');
  };

  const toggleAllergen = (id) => {
    setSelectedAllergens(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  // Allergen selection screen
  if (isAllergenScreen) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <div className="flex justify-end p-4">
          <button onClick={finish} className="text-gray-400 text-sm font-medium">
            Skip
          </button>
        </div>

        <div className="flex-1 flex flex-col px-8 pt-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center mb-6 mx-auto shadow-lg">
            <AlertTriangle className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>

          <h1 className="text-2xl font-bold text-gray-100 text-center mb-2">
            Any allergies?
          </h1>
          <p className="text-gray-500 text-center mb-6">
            We'll warn you when scanned products contain these. You can change this later.
          </p>

          <div className="grid grid-cols-3 gap-3">
            {COMMON_ALLERGENS.map(({ id, label, emoji }) => {
              const selected = selectedAllergens.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleAllergen(id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                    selected
                      ? 'border-red-400 bg-red-500/10 scale-105'
                      : 'border-gray-800 bg-gray-900'
                  }`}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className={`text-xs font-medium ${selected ? 'text-red-700' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedAllergens.length > 0 && (
            <p className="text-center text-sm text-red-400 font-medium mt-4">
              {selectedAllergens.length} allergen{selectedAllergens.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Bottom */}
        <div className="px-8 pb-10">
          <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: totalScreens }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === screen ? 'w-8 bg-orange-500/100' : 'w-2 bg-gray-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={finish}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            {selectedAllergens.length > 0 ? 'Start Scanning' : 'No Allergies — Start Scanning'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Info screens
  const current = INFO_SCREENS[screen];
  const Icon = current.icon;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex justify-end p-4">
        <button onClick={finish} className="text-gray-400 text-sm font-medium">
          Skip
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
        <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${current.color} flex items-center justify-center mb-8 shadow-lg`}>
          <Icon className="w-12 h-12 text-white" strokeWidth={1.5} />
        </div>

        <h1 className="text-2xl font-bold text-gray-100 text-center mb-3">
          {current.title}
        </h1>
        <p className="text-lg text-gray-400 text-center mb-4">
          {current.subtitle}
        </p>
        <p className="text-sm text-gray-400 text-center max-w-xs leading-relaxed">
          {current.detail}
        </p>
      </div>

      <div className="px-8 pb-10">
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: totalScreens }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === screen ? 'w-8 bg-orange-500/100' : 'w-2 bg-gray-700'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setScreen(s => s + 1)}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          Next
          <ChevronRight className="w-5 h-5" />
        </button>

        {screen === 0 && (
          <button
            onClick={() => navigate('/login')}
            className="w-full mt-3 py-3 text-gray-500 text-sm font-medium"
          >
            Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
}
