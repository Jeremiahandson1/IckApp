// Product result page — orchestrates data fetching (product, swaps, recipes,
// condition scores, favorites) and composes the display components in
// components/product/. Keep rendering logic in those components; this file
// owns state and API calls.

import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, ArrowRightLeft, ChefHat, AlertTriangle,
  Info, Leaf, Check, Apple, Heart, Share2,
} from 'lucide-react';
import { products, pantry, swaps as swapsApi, conditions as conditionsApi } from '../utils/api';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { shareProduct } from '../utils/nativeShare';
import { isValidUPC } from '../utils/helpers';
import ScoreRing from '../components/common/ScoreRing';
import { NutriScoreBadge, NovaBadge } from '../components/product/badges';
import ScoreBreakdown from '../components/product/ScoreBreakdown';
import CollapsibleSection from '../components/product/CollapsibleSection';
import NutritionFactsSection from '../components/product/NutritionFactsSection';
import IngredientCard from '../components/product/IngredientCard';
import SwapCard from '../components/product/SwapCard';
import RecipeCard from '../components/product/RecipeCard';
import ConditionView from '../components/product/ConditionView';
import AllergenAlerts from '../components/product/AllergenAlerts';
import ProductNotFound from '../components/product/ProductNotFound';
import InlineSwapPreview from '../components/product/InlineSwapPreview';

export default function ProductResult() {
  const { upc } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const passedProduct = location.state?.product || null;
  const [product, setProduct] = useState(passedProduct);
  const [swapOptions, setSwapOptions] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(!passedProduct);
  const [addedToPantry, setAddedToPantry] = useState(false);
  const [addingToPantry, setAddingToPantry] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [activeAllergens, setActiveAllergens] = useState(
    user?.allergen_alerts || (() => {
      try { return JSON.parse(localStorage.getItem('ick_allergens') || '[]'); } catch { return []; }
    })()
  );

  // Family group scan mode
  const [familyScanMembers, setFamilyScanMembers] = useState(null);

  // Condition scoring
  const [conditionViewOn, setConditionViewOn] = useState(() => {
    try { return localStorage.getItem('ick_condition_view') === 'on'; } catch { return false; }
  });
  const [conditionScores, setConditionScores] = useState([]);
  const [userConditions, setUserConditions] = useState([]);
  const [conditionLoading, setConditionLoading] = useState(false);
  const [conditionError, setConditionError] = useState(false);

  // Reset state and fetch full product data whenever UPC changes (e.g. tapping an alternative)
  useEffect(() => {
    window.scrollTo(0, 0);
    setSwapOptions([]);
    setRecipes([]);
    setAddedToPantry(false);
    setExpandedSection(null);
    // Use passed product as placeholder while loading, but always fetch full data
    const stateProduct = location.state?.product || null;
    if (stateProduct && stateProduct.upc === upc) {
      setProduct(stateProduct);
      setLoading(false);
    } else {
      setProduct(null);
      setLoading(true);
    }
    fetchProduct();
  }, [upc]);

  // Check favorite status
  useEffect(() => {
    if (!upc || !user) return;
    let cancelled = false;
    products.checkFavorite(upc).then(r => { if (!cancelled) setIsFavorited(r.favorited); }).catch(() => {});
    return () => { cancelled = true; };
  }, [upc, user]);

  const toggleFavorite = async () => {
    if (!user) {
      toast.info('Sign in to save favorites');
      navigate('/register');
      return;
    }
    // Optimistic update for instant visual feedback — keep the visual state
    // even if the API fails, to avoid confusing flash-and-revert
    const newState = !isFavorited;
    setIsFavorited(newState);
    toast.success(newState ? 'Added to favorites' : 'Removed from favorites');
    try {
      if (!newState) {
        await products.removeFavorite(upc);
        try { const cache = JSON.parse(localStorage.getItem('ick_favorites') || '[]'); localStorage.setItem('ick_favorites', JSON.stringify(cache.filter(f => f !== upc))); } catch(e) {}
      } else {
        await products.addFavorite(upc);
        try { const cache = JSON.parse(localStorage.getItem('ick_favorites') || '[]'); if (!cache.includes(upc)) cache.push(upc); localStorage.setItem('ick_favorites', JSON.stringify(cache)); } catch(e) {}
      }
    } catch (err) {
      // API failed but keep the visual state — will sync on next page load
      console.error('Favorite update failed:', err);
    }
  };

  const fetchProduct = async () => {
    setNotFound(false);

    // Reject invalid barcodes before hitting any API
    if (!isValidUPC(upc)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // onFreshData fires when a background revalidation completes after we
    // served cached data — silently swaps the displayed score for the
    // freshest one so users don't see stale verdicts after a backend fix.
    const onFreshData = (fresh) => {
      if (fresh && fresh.upc === upc) setProduct(fresh);
    };

    try {
      const result = await products.view(upc, { onFreshData });
      setProduct(result);
      fetchSwapsAndRecipes();
    } catch (error) {
      if (error.status === 404) {
        try {
          const scanResult = await products.scan(upc, { onFreshData });
          setProduct(scanResult);
          fetchSwapsAndRecipes();
        } catch (scanError) {
          setNotFound(true);
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
      setSwapOptions(swapsData?.swaps || []);
      setRecipes(swapsData?.homemade_alternatives || swapsData?.recipes || []);
    } catch {
      // Swap loading is non-critical — product still displays
    }
  };

  // Load user conditions once
  useEffect(() => {
    if (!user) return;
    conditionsApi.getUserConditions().then(setUserConditions).catch(() => {});
  }, [user]);

  // Fetch condition scores when toggle is on and product is loaded
  useEffect(() => {
    if (!conditionViewOn || !product?.id || userConditions.length === 0) {
      setConditionScores([]);
      return;
    }
    let cancelled = false;
    setConditionLoading(true);
    setConditionError(false);
    const param = userConditions.map(uc => uc.sub_type ? `${uc.slug}:${uc.sub_type}` : uc.slug).join(',');
    conditionsApi.scoreProduct(product.id, param)
      .then(data => { if (!cancelled) setConditionScores(data.conditionScores || []); })
      .catch(() => { if (!cancelled) setConditionError(true); })
      .finally(() => { if (!cancelled) setConditionLoading(false); });
    return () => { cancelled = true; };
  }, [conditionViewOn, product?.id, userConditions]);

  const toggleConditionView = () => {
    const next = !conditionViewOn;
    setConditionViewOn(next);
    localStorage.setItem('ick_condition_view', next ? 'on' : 'off');
  };

  const handleAddToPantry = async () => {
    if (addingToPantry || addedToPantry) return;
    setAddingToPantry(true);
    try {
      await pantry.add({ upc, quantity: 1 });
      setAddedToPantry(true);
      toast.success('Added to pantry!');
    } catch (error) {
      toast.error('Failed to add to pantry');
    } finally {
      setAddingToPantry(false);
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

  const handleShare = async () => {
    const score = Math.round(product.total_score);
    const verdict = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Mediocre' : score >= 20 ? 'Poor' : 'Bad';
    api.post('/analytics/event', { event_type: 'share', event_data: { upc, score } }).catch(() => {});

    const shareText = `${product.name} scored ${score}/100 (${verdict}) on Ick`;
    const shareUrl = `${window.location.origin}/product/${upc}`;
    const success = await shareProduct({
      title: `${product.name} — Ick`,
      text: shareText,
      url: shareUrl
    });
    if (success) {
      toast.success('Link copied to clipboard!');
    } else {
      // All copy methods failed — show the link directly so user can copy manually
      toast.info(`Share this link: ${shareUrl}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
             style={{ borderColor: 'var(--ick-green)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (notFound || (!product && !loading)) {
    return <ProductNotFound upc={upc} />;
  }

  if (!product) return null;

  const harmfulIngredients = product.harmful_ingredients_found || [];
  const isClean = product.total_score >= 71;
  let nutritionFacts = {};
  try {
    nutritionFacts = typeof product.nutrition_facts === 'string'
      ? JSON.parse(product.nutrition_facts || '{}')
      : (product.nutrition_facts || {});
  } catch { /* invalid JSON */ }
  let allergens = [];
  try {
    allergens = typeof product.allergens_tags === 'string'
      ? JSON.parse(product.allergens_tags || '[]')
      : (product.allergens_tags || []);
  } catch { /* invalid JSON */ }
  const nutritionKeys = ['calories', 'fat', 'saturated_fat', 'carbs', 'sugars', 'fiber', 'protein', 'sodium'];
  const hasNutrition = Object.keys(nutritionFacts).length > 0 && nutritionKeys.some(k => nutritionFacts[k] != null);

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 py-4 flex items-center justify-between pt-safe">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <ArrowLeft className="w-5 h-5" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Back</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              className="p-2 rounded-full active:scale-90 transition-transform"
              aria-label="Share this product"
            >
              <Share2 className="w-5 h-5" style={{ color: 'var(--muted)' }} />
            </button>
            <button
              onClick={toggleFavorite}
              className="p-2 rounded-full active:scale-90 transition-transform"
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`w-6 h-6 ${isFavorited ? 'text-red-500' : 'text-[#888]'}`} fill={isFavorited ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Product Image + Name */}
        <div className="px-4 pb-4 flex items-start gap-4">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 object-cover flex-shrink-0"
              style={{ background: '#1e1e1e', border: '1px solid var(--border)' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-20 h-20 flex items-center justify-center flex-shrink-0"
                 style={{ background: '#1e1e1e', border: '1px solid var(--border)' }}>
              <Apple className="w-8 h-8" style={{ color: 'var(--muted)' }} />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-[#f4f4f0] leading-tight" style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '1px', textTransform: 'uppercase' }}>{product.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px' }}>{product.brand}</p>
            {/* Nutri-Score + NOVA badges */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {product.nutriscore_grade && (
                <NutriScoreBadge grade={product.nutriscore_grade} />
              )}
              {product.nova_group && (
                <NovaBadge group={product.nova_group} />
              )}
              {product.is_organic && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs"
                      style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', fontFamily: 'var(--font-mono)', letterSpacing: '1px', fontSize: '9px', textTransform: 'uppercase' }}>
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

      {/* Condition View Toggle + Scores */}
      {user && (
        <ConditionView
          totalScore={product.total_score}
          conditionViewOn={conditionViewOn}
          onToggle={toggleConditionView}
          userConditions={userConditions}
          conditionScores={conditionScores}
          conditionLoading={conditionLoading}
          conditionError={conditionError}
        />
      )}

      {/* Inline Swap Preview — show immediately, don't bury */}
      {!isClean && swapOptions.length > 0 && (
        <InlineSwapPreview
          swapOptions={swapOptions}
          currentScore={product.total_score}
          onSwapClick={handleSwapClick}
        />
      )}

      {/* Quick Actions */}
      <div className="px-4 mt-3">
        <div className="card p-4 flex gap-3">
          {user ? (
            <button
              onClick={handleAddToPantry}
              disabled={addedToPantry || addingToPantry}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-sm font-semibold transition-colors ${
                addedToPantry
                  ? 'bg-[rgba(200,241,53,0.1)] text-[#c8f135]'
                  : 'bg-[#1e1e1e] text-[#ccc] active:bg-[#2a2a2a]'
              } disabled:opacity-60`}
            >
              {addingToPantry ? (
                <div className="w-5 h-5 border-2 border-[#c8f135] border-t-transparent rounded-full animate-spin" />
              ) : addedToPantry ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {addingToPantry ? 'Adding...' : addedToPantry ? 'In Pantry' : 'Add to Pantry'}
            </button>
          ) : (
            <button
              onClick={() => navigate('/register')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-sm font-semibold bg-[#1e1e1e] text-[#888] active:bg-[#2a2a2a]"
            >
              <Plus className="w-5 h-5" />
              Sign up to save
            </button>
          )}
        </div>
      </div>

      {/* Allergen Warnings */}
      {allergens.length > 0 && (
        <AllergenAlerts
          allergens={allergens}
          activeAllergens={activeAllergens}
          familyScanMembers={familyScanMembers}
          onAllergenChange={setActiveAllergens}
          onFamilyScanInfo={setFamilyScanMembers}
        />
      )}

      {/* Score Breakdown — collapsible "Why this score?" */}
      <ScoreBreakdown
        product={product}
        expanded={expandedSection === 'breakdown'}
        onToggle={() => setExpandedSection(expandedSection === 'breakdown' ? null : 'breakdown')}
      />

      {/* Nutrition Facts */}
      {hasNutrition && (
        <NutritionFactsSection
          nutritionFacts={nutritionFacts}
          expanded={expandedSection === 'nutrition'}
          onToggle={() => setExpandedSection(expandedSection === 'nutrition' ? null : 'nutrition')}
        />
      )}

      {/* Harmful Ingredients */}
      {harmfulIngredients.length > 0 && (
        <div className="px-4 mt-4">
          <CollapsibleSection
            title={`Additives of Concern (${harmfulIngredients.length})`}
            icon={AlertTriangle}
            iconColor="text-[#c8f135]"
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
            iconColor="text-[#c8f135]"
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
            iconColor="text-[#666]"
            expanded={expandedSection === 'full'}
            onToggle={() => setExpandedSection(expandedSection === 'full' ? null : 'full')}
          >
            <p className="text-sm text-[#888] leading-relaxed">
              {product.ingredients}
            </p>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
