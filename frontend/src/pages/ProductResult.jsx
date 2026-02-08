import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, ArrowRightLeft, ChefHat, AlertTriangle, 
  Beaker, Info, ChevronDown, ChevronUp, Leaf,
  ShieldAlert, Check, ExternalLink, Apple, Heart, Share2
} from 'lucide-react';
import { products, pantry, swaps as swapsApi } from '../utils/api';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { shareProduct } from '../utils/nativeShare';
import FamilyProfileSwitcher from '../components/common/FamilyProfileSwitcher';
import ScoreRing from '../components/common/ScoreRing';
import ScoreBadge, { ScoreBar } from '../components/common/ScoreBadge';
import { 
  getScoreLabel, getScoreLightBgClass, getScoreTextClass,
  getSeverityColor, capitalize 
} from '../utils/helpers';

export default function ProductResult() {
  const { upc } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [product, setProduct] = useState(location.state?.product || null);
  const [swapOptions, setSwapOptions] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(!product);
  const [addedToPantry, setAddedToPantry] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [activeAllergens, setActiveAllergens] = useState(
    user?.allergen_alerts || (() => {
      try { return JSON.parse(localStorage.getItem('ick_allergens') || '[]'); } catch { return []; }
    })()
  );

  useEffect(() => {
    if (!product) {
      fetchProduct();
    } else {
      fetchSwapsAndRecipes();
    }
  }, [upc]);

  // Check favorite status
  useEffect(() => {
    if (upc && user) {
      products.checkFavorite(upc).then(r => setIsFavorited(r.favorited)).catch(() => {});
    }
  }, [upc, user]);

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/register');
      return;
    }
    try {
      if (isFavorited) {
        await products.removeFavorite(upc);
        setIsFavorited(false);
        try { const cache = JSON.parse(localStorage.getItem('ick_favorites') || '[]'); localStorage.setItem('ick_favorites', JSON.stringify(cache.filter(f => f !== upc))); } catch(e) {}
      } else {
        await products.addFavorite(upc);
        setIsFavorited(true);
        try { const cache = JSON.parse(localStorage.getItem('ick_favorites') || '[]'); if (!cache.includes(upc)) cache.push(upc); localStorage.setItem('ick_favorites', JSON.stringify(cache)); } catch(e) {}
      }
    } catch (err) {
      toast.error('Failed to update favorite');
    }
  };

  const fetchProduct = async () => {
    try {
      const result = await products.view(upc);
      setProduct(result);
      fetchSwapsAndRecipes();
    } catch (error) {
      if (error.status === 404) {
        try {
          const scanResult = await products.scan(upc);
          setProduct(scanResult);
          fetchSwapsAndRecipes();
        } catch (scanError) {
          toast.error('Product not found');
          navigate('/scan');
        }
      } else {
        toast.error('Failed to load product');
        navigate('/scan');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSwapsAndRecipes = async () => {
    try {
      const [swapsData] = await Promise.all([
        swapsApi.forProduct(upc)
      ]);
      setSwapOptions(swapsData.swaps || []);
      setRecipes(swapsData.homemade_alternatives || swapsData.recipes || []);
    } catch (error) {
      console.error('Error fetching swaps:', error);
    }
  };

  const handleAddToPantry = async () => {
    try {
      await pantry.add({ upc, quantity: 1 });
      setAddedToPantry(true);
      toast.success('Added to pantry');
    } catch (error) {
      toast.error('Failed to add to pantry');
    }
  };

  const handleSwapClick = async (swapProduct) => {
    try {
      await swapsApi.click(product.id, swapProduct.id);
      navigate(`/product/${swapProduct.upc}`, { state: { product: swapProduct } });
    } catch (error) {
      navigate(`/product/${swapProduct.upc}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) return null;

  const harmfulIngredients = product.harmful_ingredients_found || [];
  const isClean = product.total_score >= 71;
  const nutritionFacts = typeof product.nutrition_facts === 'string' 
    ? JSON.parse(product.nutrition_facts || '{}') 
    : (product.nutrition_facts || {});
  const allergens = typeof product.allergens_tags === 'string'
    ? JSON.parse(product.allergens_tags || '[]')
    : (product.allergens_tags || []);
  const hasNutrition = Object.keys(nutritionFacts).length > 0;

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {/* Header */}
      <div className="bg-gray-950 pt-safe">
        <div className="px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-300"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                const score = Math.round(product.total_score);
                const verdict = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Mediocre' : score >= 20 ? 'Poor' : 'Bad';
                api.post('/analytics/event', { event_type: 'share', event_data: { upc, score } }).catch(() => {});
                
                const success = await shareProduct({
                  title: `${product.name} — Ick`,
                  text: `${product.name} scored ${score}/100 (${verdict}) on Ick`,
                  url: `${window.location.origin}/product/${upc}`
                });
                if (success && !navigator.share) toast.success('Link copied!');
              }}
              className="p-2 rounded-full active:scale-90 transition-transform"
            >
              <Share2 className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={toggleFavorite}
              className="p-2 rounded-full active:scale-90 transition-transform"
            >
              <Heart className={`w-6 h-6 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>

        {/* Product Image + Name */}
        <div className="px-6 pb-4 flex items-start gap-4">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="w-24 h-24 rounded-xl object-cover bg-gray-800 flex-shrink-0 shadow-sm"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Apple className="w-10 h-10 text-gray-300" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-xl font-bold text-gray-100 leading-tight">{product.name}</h1>
            <p className="text-gray-500 text-sm mt-1">{product.brand}</p>
            {/* Nutri-Score + NOVA badges */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {product.nutriscore_grade && (
                <NutriScoreBadge grade={product.nutriscore_grade} />
              )}
              {product.nova_group && (
                <NovaBadge group={product.nova_group} />
              )}
              {product.is_organic && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-700 text-xs font-semibold rounded-full">
                  <Leaf className="w-3 h-3" /> Organic
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Ring — the emotional punch */}
      <div className="px-4 -mt-1">
        <ScoreRing score={product.total_score} name={product.name} />
      </div>

      {/* Inline Swap Preview — show immediately, don't bury */}
      {!isClean && swapOptions.length > 0 && (
        <div className="px-4 mt-3">
          <div className="bg-gray-950 rounded-2xl p-4 shadow-sm border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRightLeft className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-gray-300">Better Alternative</span>
            </div>
            {(() => {
              const best = swapOptions[0];
              const improvement = Math.round((best.total_score || 0) - (product.total_score || 0));
              return (
                <button
                  onClick={() => handleSwapClick(best)}
                  className="w-full flex items-center gap-3 text-left active:bg-gray-900 rounded-xl transition-colors"
                >
                  {best.image_url ? (
                    <img src={best.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-800"
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <ArrowRightLeft className="w-5 h-5 text-orange-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-100 truncate">{best.name}</p>
                    <p className="text-xs text-gray-500">{best.brand}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-orange-400">
                      +{improvement}
                    </div>
                    <div className="text-[10px] text-orange-500 font-medium">points</div>
                  </div>
                </button>
              );
            })()}
            {swapOptions.length > 1 && (
              <button
                onClick={() => document.getElementById('swaps-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-3 w-full text-center text-xs text-orange-400 font-medium"
              >
                +{swapOptions.length - 1} more alternatives ↓
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 mt-3">
        <div className="card p-4 flex gap-3">
          {user ? (
            <button
              onClick={handleAddToPantry}
              disabled={addedToPantry}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors ${
                addedToPantry 
                  ? 'bg-orange-500/20 text-orange-400' 
                  : 'bg-gray-800 text-gray-300 active:bg-gray-700'
              }`}
            >
              {addedToPantry ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {addedToPantry ? 'In Pantry' : 'Add to Pantry'}
            </button>
          ) : (
            <button
              onClick={() => navigate('/register')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-gray-800 text-gray-400 active:bg-gray-700"
            >
              <Plus className="w-5 h-5" />
              Sign up to save
            </button>
          )}
        </div>
      </div>

      {/* Allergen Warnings */}
      {allergens.length > 0 && (() => {
        // Family profile switcher — lets user switch who they're scanning for
        const userAllergens = activeAllergens;
        const matchedAllergens = allergens.filter(a => 
          userAllergens.some(ua => 
            a.toLowerCase().includes(ua.toLowerCase()) || 
            ua.toLowerCase().includes(a.toLowerCase())
          )
        );
        const hasPersonalMatch = matchedAllergens.length > 0;

        return (
          <div className="mt-4 space-y-3">
            {/* Family profile switcher */}
            <FamilyProfileSwitcher onAllergenChange={setActiveAllergens} />

            <div className="px-4 space-y-3">
            {/* Personal allergen alert — red, prominent */}
            {hasPersonalMatch && (
              <div className="bg-red-500/10 border-2 border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="font-bold text-red-300">⚠️ Contains YOUR Allergens</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {matchedAllergens.map((a, i) => (
                    <span key={i} className="px-3 py-1.5 bg-red-500/30 text-red-200 text-sm font-bold rounded-full">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* General allergen list */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-amber-300">Contains Allergens</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {allergens.map((a, i) => (
                  <span key={i} className={`px-2.5 py-1 text-sm font-medium rounded-full ${
                    matchedAllergens.includes(a) 
                      ? 'bg-red-500/20 text-red-300 ring-2 ring-red-300' 
                      : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
            </div>
          </div>
        );
      })()}

      {/* Score Breakdown — the 3 real dimensions */}
      <div className="px-4 mt-6">
        <div className="card p-4">
          <h2 className="font-semibold text-gray-100 mb-4">Score Breakdown</h2>
          <div className="space-y-4">
            <ScoreItem 
              icon={Apple} 
              label="Nutritional Quality" 
              score={product.nutrition_score ?? product.banned_elsewhere_score ?? 50}
              weight="60%"
              detail={product.nutriscore_grade ? `Nutri-Score ${product.nutriscore_grade.toUpperCase()}` : null}
            />
            <ScoreItem 
              icon={Beaker} 
              label="Additives" 
              score={product.additives_score ?? product.harmful_ingredients_score ?? 50}
              weight="30%"
              detail={harmfulIngredients.length > 0 ? `${harmfulIngredients.length} found` : 'None detected'}
            />
            <ScoreItem 
              icon={Leaf} 
              label="Organic Bonus" 
              score={product.organic_bonus ?? product.transparency_score ?? 0}
              weight="10%"
              detail={product.is_organic ? 'Certified organic' : 'Not organic'}
            />
          </div>
        </div>
      </div>

      {/* Nutrition Facts */}
      {hasNutrition && (
        <div className="px-4 mt-4">
          <CollapsibleSection
            title="Nutrition Facts"
            subtitle="per 100g"
            icon={Apple}
            iconColor="text-blue-500"
            expanded={expandedSection === 'nutrition'}
            onToggle={() => setExpandedSection(expandedSection === 'nutrition' ? null : 'nutrition')}
          >
            <div className="grid grid-cols-2 gap-3">
              {nutritionFacts.calories != null && (
                <NutrientRow label="Calories" value={nutritionFacts.calories} unit="kcal" highlight />
              )}
              {nutritionFacts.fat != null && (
                <NutrientRow label="Fat" value={nutritionFacts.fat} unit="g" />
              )}
              {nutritionFacts.saturated_fat != null && (
                <NutrientRow label="Sat. Fat" value={nutritionFacts.saturated_fat} unit="g" warn={nutritionFacts.saturated_fat > 5} />
              )}
              {nutritionFacts.carbs != null && (
                <NutrientRow label="Carbs" value={nutritionFacts.carbs} unit="g" />
              )}
              {nutritionFacts.sugars != null && (
                <NutrientRow label="Sugars" value={nutritionFacts.sugars} unit="g" warn={nutritionFacts.sugars > 12} />
              )}
              {nutritionFacts.fiber != null && (
                <NutrientRow label="Fiber" value={nutritionFacts.fiber} unit="g" good={nutritionFacts.fiber > 3} />
              )}
              {nutritionFacts.protein != null && (
                <NutrientRow label="Protein" value={nutritionFacts.protein} unit="g" good={nutritionFacts.protein > 5} />
              )}
              {nutritionFacts.sodium != null && (
                <NutrientRow label="Sodium" value={nutritionFacts.sodium} unit="mg" warn={nutritionFacts.sodium > 600} />
              )}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Harmful Ingredients */}
      {harmfulIngredients.length > 0 && (
        <div className="px-4 mt-4">
          <CollapsibleSection
            title={`Additives of Concern (${harmfulIngredients.length})`}
            icon={AlertTriangle}
            iconColor="text-orange-500"
            expanded={expandedSection === 'ingredients'}
            onToggle={() => setExpandedSection(expandedSection === 'ingredients' ? null : 'ingredients')}
          >
            <div className="space-y-3">
              {harmfulIngredients.map((ingredient, idx) => (
                <IngredientCard key={idx} ingredient={ingredient} />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Swaps Section */}
      {swapOptions.length > 0 && (
        <div id="swaps-section" className="px-4 mt-4">
          <CollapsibleSection
            title={`Better Alternatives (${swapOptions.length})`}
            icon={ArrowRightLeft}
            iconColor="text-orange-500"
            expanded={expandedSection === 'swaps'}
            onToggle={() => setExpandedSection(expandedSection === 'swaps' ? null : 'swaps')}
          >
            <div className="space-y-3">
              {swapOptions.map((swap, idx) => (
                <SwapCard 
                  key={idx} 
                  swap={swap} 
                  currentScore={product.total_score}
                  onClick={() => handleSwapClick(swap)}
                />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Homemade Recipes */}
      {recipes.length > 0 && (
        <div className="px-4 mt-4">
          <CollapsibleSection
            title={`Make It At Home (${recipes.length})`}
            icon={ChefHat}
            iconColor="text-violet-500"
            expanded={expandedSection === 'recipes'}
            onToggle={() => setExpandedSection(expandedSection === 'recipes' ? null : 'recipes')}
          >
            <div className="space-y-3">
              {recipes.map((recipe, idx) => (
                <RecipeCard 
                  key={idx} 
                  recipe={recipe}
                  onClick={() => navigate(`/recipes/${recipe.id}`)}
                />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Full Ingredients List */}
      {product.ingredients && (
        <div className="px-4 mt-4 mb-8">
          <CollapsibleSection
            title="Full Ingredients"
            icon={Info}
            iconColor="text-gray-500"
            expanded={expandedSection === 'full'}
            onToggle={() => setExpandedSection(expandedSection === 'full' ? null : 'full')}
          >
            <p className="text-sm text-gray-400 leading-relaxed">
              {product.ingredients}
            </p>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function NutriScoreBadge({ grade }) {
  const colors = {
    a: 'bg-green-600', b: 'bg-lime-500', c: 'bg-yellow-400',
    d: 'bg-orange-500/100', e: 'bg-red-500/100',
  };
  const textColors = {
    a: 'text-white', b: 'text-white', c: 'text-gray-100',
    d: 'text-white', e: 'text-white',
  };
  const g = grade.toLowerCase();
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 font-medium">Nutri-Score</span>
      <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${colors[g] || 'bg-gray-400'} ${textColors[g] || 'text-white'}`}>
        {g.toUpperCase()}
      </span>
    </div>
  );
}

function NovaBadge({ group }) {
  const labels = { 1: 'Unprocessed', 2: 'Processed ingredients', 3: 'Processed', 4: 'Ultra-processed' };
  const colors = { 1: 'text-green-700 bg-green-500/20', 2: 'text-lime-700 bg-lime-100', 3: 'text-orange-700 bg-orange-500/20', 4: 'text-red-700 bg-red-500/20' };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors[group] || 'text-gray-300 bg-gray-800'}`}>
      NOVA {group}
    </span>
  );
}

function NutrientRow({ label, value, unit, warn, good, highlight }) {
  const valueColor = warn ? 'text-red-400' : good ? 'text-orange-400' : 'text-gray-100';
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${highlight ? 'bg-gray-800' : ''}`}>
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${valueColor}`}>
        {value}{unit}
        {warn && <span className="ml-1 text-red-400">●</span>}
        {good && <span className="ml-1 text-orange-400">●</span>}
      </span>
    </div>
  );
}

function ScoreItem({ icon: Icon, label, score, weight, detail }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-300">{label}</span>
          <div className="flex items-center gap-2">
            {detail && <span className="text-gray-400 text-xs">{detail}</span>}
            <span className="text-gray-400 text-xs">{weight}</span>
          </div>
        </div>
        <ScoreBar score={score} />
      </div>
    </div>
  );
}

function CollapsibleSection({ title, subtitle, icon: Icon, iconColor, expanded, onToggle, children }) {
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <div className="text-left">
            <span className="font-semibold text-gray-100">{title}</span>
            {subtitle && <span className="text-xs text-gray-400 ml-2">{subtitle}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-4">{children}</div>
      )}
    </div>
  );
}

function IngredientCard({ ingredient }) {
  const severityClass = getSeverityColor(ingredient.severity);
  return (
    <div className="p-4 bg-gray-900 rounded-xl">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-100">{ingredient.name}</h4>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${severityClass}`}>
          Risk {ingredient.severity}/10
        </span>
      </div>
      {ingredient.health_effects && (
        <p className="text-sm text-gray-400 mb-2">{ingredient.health_effects}</p>
      )}
      {ingredient.banned_in && ingredient.banned_in.length > 0 && (
        <p className="text-xs text-red-400 font-medium mb-1">
          Banned in: {ingredient.banned_in.join(', ')}
        </p>
      )}
      {ingredient.why_used && (
        <p className="text-xs text-gray-500 mb-1">
          <strong>Why used:</strong> {ingredient.why_used}
        </p>
      )}
      {ingredient.source_url && (
        <a
          href={ingredient.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-1"
        >
          <ExternalLink className="w-3 h-3" /> Scientific source
        </a>
      )}
    </div>
  );
}

function SwapCard({ swap, currentScore, onClick }) {
  const improvement = swap.total_score - currentScore;
  return (
    <button onClick={onClick} className="w-full p-4 bg-orange-500/10 rounded-xl text-left card-pressed">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-100">{swap.name}</h4>
          <p className="text-sm text-gray-400">{swap.brand}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-orange-400">{Math.round(swap.total_score)}</span>
          <p className="text-xs text-orange-400 font-medium">+{improvement} pts</p>
        </div>
      </div>
    </button>
  );
}

function RecipeCard({ recipe, onClick }) {
  return (
    <button onClick={onClick} className="w-full p-4 bg-violet-50 rounded-xl text-left card-pressed">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-100">{recipe.name}</h4>
          <p className="text-sm text-gray-400">
            {recipe.prep_time_minutes} min prep • {recipe.difficulty}
          </p>
        </div>
        <ChefHat className="w-6 h-6 text-violet-500" />
      </div>
      {recipe.vs_store_bought && (
        <p className="text-xs text-violet-600 mt-2">{recipe.vs_store_bought}</p>
      )}
    </button>
  );
}
