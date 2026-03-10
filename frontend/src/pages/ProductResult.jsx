import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, ArrowRightLeft, ChefHat, AlertTriangle,
  Beaker, Info, ChevronDown, ChevronUp, Leaf,
  ShieldAlert, Check, ExternalLink, Apple, Heart, Share2,
  UtensilsCrossed, ShoppingCart
} from 'lucide-react';
import { products, pantry, swaps as swapsApi, recipes as recipesApi, conditions as conditionsApi } from '../utils/api';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { shareProduct } from '../utils/nativeShare';
import FamilyProfileSwitcher from '../components/common/FamilyProfileSwitcher';
import ScoreRing from '../components/common/ScoreRing';
import ScoreBadge, { ScoreBar } from '../components/common/ScoreBadge';
import {
  getScoreLabel, getScoreLightBgClass, getScoreTextClass,
  getSeverityColor, capitalize, getScoreExplanation
} from '../utils/helpers';

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
  const [expandedSection, setExpandedSection] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [spoonacularRecipes, setSpoonacularRecipes] = useState([]);
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

  // Reset state and fetch full product data whenever UPC changes (e.g. tapping an alternative)
  useEffect(() => {
    window.scrollTo(0, 0);
    setSwapOptions([]);
    setRecipes([]);
    setSpoonacularRecipes([]);
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
    const param = userConditions.map(uc => uc.sub_type ? `${uc.slug}:${uc.sub_type}` : uc.slug).join(',');
    conditionsApi.scoreProduct(product.id, param)
      .then(data => { if (!cancelled) setConditionScores(data.conditionScores || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setConditionLoading(false); });
    return () => { cancelled = true; };
  }, [conditionViewOn, product?.id, userConditions]);

  const toggleConditionView = () => {
    const next = !conditionViewOn;
    setConditionViewOn(next);
    localStorage.setItem('ick_condition_view', next ? 'on' : 'off');
  };

  // Fetch Spoonacular "Make It Yourself" recipes when score is bad
  useEffect(() => {
    if (!product || product.total_score >= 71 || !product.ingredients) return;
    let cancelled = false;
    recipesApi.spoonacular(upc)
      .then(data => { if (!cancelled) setSpoonacularRecipes(data?.recipes || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product?.total_score, product?.ingredients, upc]);

  const [addingToPantry, setAddingToPantry] = useState(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
             style={{ borderColor: 'var(--ick-green)', borderTopColor: 'transparent' }} />
      </div>
    );
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
  const hasNutrition = Object.keys(nutritionFacts).length > 0;

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
              <Share2 className="w-5 h-5" style={{ color: 'var(--muted)' }} />
            </button>
            <button
              onClick={toggleFavorite}
              className="p-2 rounded-full active:scale-90 transition-transform"
            >
              <Heart className={`w-6 h-6 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-[#888]'}`} />
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
        <div className="px-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#888]" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Condition View
            </span>
            <button
              onClick={toggleConditionView}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                conditionViewOn ? 'bg-[#c8f135]' : 'bg-[#333]'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${
                conditionViewOn ? 'translate-x-7 bg-[#0d0d0d]' : 'translate-x-1 bg-[#888]'
              }`} />
            </button>
          </div>

          {conditionViewOn && userConditions.length === 0 && (
            <div className="bg-[#1e1e1e] rounded-sm p-3 text-center">
              <p className="text-sm text-[#888]">No health conditions set.</p>
              <button
                onClick={() => navigate('/profile')}
                className="text-xs text-[#c8f135] font-medium mt-1"
              >
                Set conditions in your profile →
              </button>
            </div>
          )}

          {conditionViewOn && userConditions.length > 0 && (
            <div className="space-y-2">
              {/* Score pills */}
              <div className="flex flex-wrap gap-2">
                <div className={`px-3 py-1.5 rounded-sm text-sm font-semibold ${
                  product.total_score >= 75 ? 'bg-green-500/10 text-green-400' :
                  product.total_score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                  product.total_score >= 25 ? 'bg-orange-500/10 text-orange-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  Normal: {Math.round(product.total_score ?? 0)}
                </div>
                {conditionLoading ? (
                  <div className="px-3 py-1.5 bg-[#1e1e1e] rounded-sm text-sm text-[#888]">
                    Scoring...
                  </div>
                ) : conditionScores.map(cs => {
                  const CONDITION_ICONS = { thyroid: '\uD83E\uDD8B', diabetes: '\uD83E\uDE78', heart: '\u2764\uFE0F', kidney: '\uD83E\uDED8', celiac: '\uD83C\uDF3E' };
                  const scoreColor = cs.score >= 75 ? 'bg-green-500/10 text-green-400' :
                    cs.score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                    cs.score >= 25 ? 'bg-orange-500/10 text-orange-400' :
                    'bg-red-500/10 text-red-400';
                  return (
                    <div key={cs.slug} className={`px-3 py-1.5 rounded-sm text-sm font-semibold ${scoreColor}`}>
                      {CONDITION_ICONS[cs.slug] || ''} {cs.label}: {cs.score}
                    </div>
                  );
                })}
              </div>

              {/* Expandable flags per condition */}
              {!conditionLoading && conditionScores.map(cs => (
                cs.flags.length > 0 && (
                  <ConditionFlagsSection key={cs.slug} conditionScore={cs} />
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline Swap Preview — show immediately, don't bury */}
      {!isClean && swapOptions.length > 0 && (
        <div className="px-4 mt-3">
          <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRightLeft className="w-4 h-4 text-[#c8f135]" />
              <span className="text-sm font-semibold text-[#ccc]">Better Alternative</span>
            </div>
            {(() => {
              const best = swapOptions[0];
              const improvement = Math.round((best.total_score || 0) - (product.total_score || 0));
              return (
                <button
                  onClick={() => handleSwapClick(best)}
                  className="w-full flex items-center gap-3 text-left active:bg-[#0a0a0a] rounded-sm transition-colors"
                >
                  {best.image_url ? (
                    <img src={best.image_url} alt="" className="w-12 h-12 rounded-sm object-cover bg-[#1e1e1e]"
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-sm bg-[rgba(200,241,53,0.06)] flex items-center justify-center">
                      <ArrowRightLeft className="w-5 h-5 text-[#c8f135]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#f4f4f0] truncate">{best.name}</p>
                    <p className="text-xs text-[#666]">{best.brand}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#c8f135]">
                      +{improvement}
                    </div>
                    <div className="text-[10px] text-[#c8f135] font-medium">points</div>
                  </div>
                </button>
              );
            })()}
            {swapOptions.length > 1 && (
              <button
                onClick={() => document.getElementById('swaps-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-3 w-full text-center text-xs text-[#c8f135] font-medium"
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
            <FamilyProfileSwitcher onAllergenChange={setActiveAllergens} onFamilyScanInfo={setFamilyScanMembers} />

            <div className="px-4 space-y-3">
            {/* Personal allergen alert — red, prominent */}
            {hasPersonalMatch && (
              <div className="bg-red-500/10 border-2 border-red-500/30 rounded-sm p-4">
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
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-sm p-4">
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
            {/* Family group member alerts — show who is affected */}
            {familyScanMembers && familyScanMembers.length > 0 && (() => {
              const affected = familyScanMembers.filter(m => {
                const memberAllergens = m.allergies || [];
                return memberAllergens.some(ma =>
                  allergens.some(a => a.toLowerCase().includes(ma.toLowerCase()) || ma.toLowerCase().includes(a.toLowerCase()))
                );
              });
              if (affected.length === 0) return null;
              return (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-purple-300 text-sm">Family Members Affected</span>
                  </div>
                  <div className="space-y-1.5">
                    {affected.map(m => {
                      const matched = (m.allergies || []).filter(ma =>
                        allergens.some(a => a.toLowerCase().includes(ma.toLowerCase()) || ma.toLowerCase().includes(a.toLowerCase()))
                      );
                      return (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="text-sm font-medium text-purple-200">{m.name}:</span>
                          <div className="flex flex-wrap gap-1">
                            {matched.map((a, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{a}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            </div>
          </div>
        );
      })()}

      {/* Score Breakdown — collapsible "Why this score?" */}
      {(() => {
        const explanation = getScoreExplanation(product);
        const isBreakdownOpen = expandedSection === 'breakdown';
        return (
          <div className="px-4 mt-6">
            <div className="card overflow-hidden">
              <button
                onClick={() => setExpandedSection(isBreakdownOpen ? null : 'breakdown')}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-[#c8f135]" />
                  <div className="text-left">
                    <span className="font-semibold text-[#f4f4f0]">Why this score?</span>
                    {explanation.summary && (
                      <p className="text-xs text-[#888] mt-0.5 line-clamp-1">{explanation.summary}</p>
                    )}
                  </div>
                </div>
                {isBreakdownOpen ? <ChevronUp className="w-5 h-5 text-[#888]" /> : <ChevronDown className="w-5 h-5 text-[#888]" />}
              </button>

              {isBreakdownOpen && (
                <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-4">
                  <div className="space-y-1">
                    <ScoreItem
                      icon={ShieldAlert}
                      label="Harmful Ingredients"
                      score={product.harmful_ingredients_score ?? 50}
                      weight="40%"
                      detail={explanation.harmful_detail}
                      items={explanation.harmful_items}
                      type="harmful"
                    />
                    <ScoreItem
                      icon={AlertTriangle}
                      label="Banned Elsewhere"
                      score={product.banned_elsewhere_score ?? 50}
                      weight="20%"
                      detail={explanation.banned_detail}
                      items={explanation.banned_items}
                      type="banned"
                    />
                    <ScoreItem
                      icon={Info}
                      label="Transparency"
                      score={product.transparency_score ?? 50}
                      weight="15%"
                      detail={explanation.transparency_detail}
                      items={explanation.transparency_items}
                      type="transparency"
                    />
                    <ScoreItem
                      icon={Beaker}
                      label="Processing Level"
                      score={product.processing_score ?? 50}
                      weight="15%"
                      detail={explanation.processing_detail}
                      items={explanation.processing_items}
                      type="processing"
                    />
                    <ScoreItem
                      icon={ShoppingCart}
                      label="Company Behavior"
                      score={product.company_behavior_score ?? 50}
                      weight="10%"
                      detail={explanation.company_detail}
                      items={explanation.company_items}
                      type="company"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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

      {/* Spoonacular: Make It Yourself — only when score is bad */}
      {!isClean && spoonacularRecipes.length > 0 && (
        <div className="px-4 mt-4">
          <CollapsibleSection
            title={`Make It Yourself (${spoonacularRecipes.length})`}
            icon={UtensilsCrossed}
            iconColor="text-emerald-500"
            expanded={expandedSection === 'diy-recipes'}
            onToggle={() => setExpandedSection(expandedSection === 'diy-recipes' ? null : 'diy-recipes')}
          >
            <p className="text-xs text-[#888] mb-3">
              Recipes using this product's ingredients. Items you already have in your pantry are highlighted.
            </p>
            <div className="space-y-3">
              {spoonacularRecipes.map((recipe) => (
                <SpoonacularRecipeCard key={recipe.id} recipe={recipe} />
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

// ============================================================
// SUB-COMPONENTS
// ============================================================

function NutriScoreBadge({ grade }) {
  const colors = {
    a: 'bg-green-600', b: 'bg-lime-500', c: 'bg-yellow-400',
    d: 'bg-[rgba(200,241,53,0.06)]', e: 'bg-red-500/100',
  };
  const textColors = {
    a: 'text-white', b: 'text-white', c: 'text-[#f4f4f0]',
    d: 'text-white', e: 'text-white',
  };
  const g = grade.toLowerCase();
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-[#666] font-medium">Nutri-Score</span>
      <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${colors[g] || 'bg-gray-400'} ${textColors[g] || 'text-white'}`}>
        {g.toUpperCase()}
      </span>
    </div>
  );
}

function NovaBadge({ group }) {
  const labels = { 1: 'Unprocessed', 2: 'Processed ingredients', 3: 'Processed', 4: 'Ultra-processed' };
  const colors = { 1: 'text-green-700 bg-green-500/20', 2: 'text-lime-700 bg-lime-100', 3: 'text-[#7a8e00] bg-[rgba(200,241,53,0.1)]', 4: 'text-red-700 bg-red-500/20' };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors[group] || 'text-[#ccc] bg-[#1e1e1e]'}`}>
      NOVA {group}
    </span>
  );
}

function NutrientRow({ label, value, unit, warn, good, highlight }) {
  const valueColor = warn ? 'text-red-400' : good ? 'text-[#c8f135]' : 'text-[#f4f4f0]';
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded-sm ${highlight ? 'bg-[#1e1e1e]' : ''}`}>
      <span className="text-sm text-[#888]">{label}</span>
      <span className={`text-sm font-semibold ${valueColor}`}>
        {value}{unit}
        {warn && <span className="ml-1 text-red-400">●</span>}
        {good && <span className="ml-1 text-[#c8f135]">●</span>}
      </span>
    </div>
  );
}

function ScoreItem({ icon: Icon, label, score, weight, detail, items = [], type }) {
  const [open, setOpen] = useState(false);
  const hasDetail = (items && items.length > 0) || detail;
  const detailColor = score >= 70 ? '#5a9a4a' : score >= 40 ? '#b08a5e' : '#c45a4a';

  return (
    <div className="py-3 border-b border-[#1e1e1e] last:border-0">
      <button
        onClick={() => hasDetail && setOpen(!open)}
        className="w-full flex items-start gap-3 text-left"
      >
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: detailColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm text-[#ccc]">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: detailColor }}>{Math.round(score)}/100</span>
              <span className="text-[10px] text-[#555]">{weight}</span>
            </div>
          </div>
          <ScoreBar score={score} />
          {detail && (
            <p className="text-xs mt-1.5" style={{ color: '#999', fontWeight: 300, lineHeight: 1.4 }}>
              {detail}
            </p>
          )}
        </div>
        {hasDetail && items.length > 0 && (
          <ChevronDown className={`w-4 h-4 text-[#555] flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && items.length > 0 && (
        <div className="mt-2 ml-7 space-y-1.5">
          {type === 'harmful' && items.map((item, i) => (
            <div key={i} className="p-2 rounded-sm" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#ddd]">{item.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm" style={{
                  background: item.severity >= 8 ? 'rgba(239,68,68,0.15)' : item.severity >= 5 ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)',
                  color: item.severity >= 8 ? '#f87171' : item.severity >= 5 ? '#fbbf24' : '#9ca3af',
                  fontFamily: 'var(--font-mono)', letterSpacing: '1px'
                }}>
                  {item.severity}/10
                </span>
              </div>
              {item.effect && <p className="text-[11px] text-[#888] mt-1" style={{ lineHeight: 1.4 }}>{item.effect}</p>}
              {item.why && <p className="text-[11px] text-[#666] mt-0.5 italic">Used as: {item.why}</p>}
            </div>
          ))}

          {type === 'banned' && items.map((item, i) => (
            <div key={i} className="p-2 rounded-sm" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <span className="text-xs font-medium text-[#ddd]">{item.name}</span>
              <p className="text-[11px] text-[#e88] mt-0.5">
                Banned in: {item.countries.join(', ')}
              </p>
            </div>
          ))}

          {type === 'transparency' && items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              {item.present ? (
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 flex items-center justify-center text-[#555] flex-shrink-0">✕</span>
              )}
              <span className={`text-xs ${item.present ? 'text-[#aaa]' : 'text-[#666]'}`}>
                {item.label}{item.partial ? ' (partial)' : ''}
              </span>
            </div>
          ))}

          {type === 'processing' && items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              <span className="text-xs text-[#aaa]">{item}</span>
            </div>
          ))}

          {type === 'company' && items.map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
              <span className="text-xs text-[#aaa]" style={{ lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
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
            <span className="font-semibold text-[#f4f4f0]">{title}</span>
            {subtitle && <span className="text-xs text-[#888] ml-2">{subtitle}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-[#888]" /> : <ChevronDown className="w-5 h-5 text-[#888]" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-4">{children}</div>
      )}
    </div>
  );
}

function IngredientCard({ ingredient }) {
  return (
    <div className="p-4" style={{ background: '#111', border: '1px solid rgba(255,59,48,0.15)' }}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-[#f4f4f0]" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '1px', textTransform: 'uppercase' }}>{ingredient.name}</h4>
        <span className="text-xs px-2 py-0.5" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px', background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', color: 'var(--red)' }}>
          RISK {ingredient.severity}/10
        </span>
      </div>
      {ingredient.health_effects && (
        <p className="text-sm text-[#888] mb-2" style={{ fontWeight: 300 }}>{ingredient.health_effects}</p>
      )}
      {ingredient.banned_in && ingredient.banned_in.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {ingredient.banned_in.map((country, i) => (
            <span key={i} className="text-xs px-2 py-0.5" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', color: 'var(--red)' }}>
              BANNED: {country.toUpperCase()}
            </span>
          ))}
        </div>
      )}
      {ingredient.why_used && (
        <p className="text-xs text-[#666] mb-1" style={{ fontStyle: 'italic' }}>
          Why it's in there: {ingredient.why_used}
        </p>
      )}
      {ingredient.source_url && (
        <a
          href={ingredient.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline mt-1"
          style={{ color: 'var(--ick-green)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px' }}
        >
          <ExternalLink className="w-3 h-3" /> SOURCE ↗
        </a>
      )}
    </div>
  );
}

function SwapCard({ swap, currentScore, onClick }) {
  const improvement = swap.total_score - currentScore;
  const stores = swap.nearby_stores || [];
  const links = swap.online_links || [];
  
  return (
    <div className="p-4 bg-[rgba(200,241,53,0.06)] rounded-sm">
      <button onClick={onClick} className="w-full text-left card-pressed">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[#f4f4f0] truncate">{swap.name}</h4>
            <p className="text-sm text-[#888]">{swap.brand}</p>
          </div>
          <div className="text-right ml-3">
            <span className="text-2xl font-bold text-[#c8f135]">{Math.round(swap.total_score)}</span>
            <p className="text-xs text-[#c8f135] font-medium">+{improvement} pts</p>
          </div>
        </div>
      </button>
      
      {/* Where to Buy — stores */}
      {stores.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#333]/50">
          <p className="text-xs font-medium text-[#888] mb-1.5">Available at</p>
          <div className="flex flex-wrap gap-1.5">
            {stores.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-[#2a2a2a]/60 text-[#ccc] rounded-full">
                {s.store_name}{s.price ? ` · $${Number(s.price).toFixed(2)}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Online purchase links */}
      {links.length > 0 && (
        <div className={`${stores.length > 0 ? 'mt-2' : 'mt-3 pt-3 border-t border-[#333]/50'}`}>
          {stores.length === 0 && <p className="text-xs font-medium text-[#888] mb-1.5">Buy online</p>}
          <div className="flex flex-wrap gap-1.5">
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs px-2 py-0.5 bg-[rgba(200,241,53,0.1)] text-[#c8f135] rounded-full hover:bg-[rgba(200,241,53,0.15)] transition-colors"
              >
                {link.name} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpoonacularRecipeCard({ recipe }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 bg-emerald-500/5 rounded-sm border border-emerald-500/10">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start gap-3">
          {recipe.image && (
            <img
              src={recipe.image}
              alt=""
              className="w-16 h-16 rounded-sm object-cover flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[#f4f4f0] text-sm leading-tight">{recipe.title}</h4>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-emerald-400 font-medium">
                {recipe.have_count} have
              </span>
              <span className="text-xs text-[#888]">
                {recipe.need_count} need
              </span>
            </div>
            {/* Mini progress bar */}
            <div className="mt-1.5 h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${recipe.ingredients?.length > 0
                    ? Math.min((recipe.have_count / recipe.ingredients.length) * 100, 100)
                    : 0}%`
                }}
              />
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-[#888] mt-1" /> : <ChevronDown className="w-4 h-4 text-[#888] mt-1" />}
        </div>
      </button>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-emerald-500/10 space-y-1.5">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {(ing.in_pantry || ing.is_from_product) ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <ShoppingCart className="w-3.5 h-3.5 text-[#666] flex-shrink-0" />
              )}
              <span className={ing.in_pantry || ing.is_from_product ? 'text-emerald-300' : 'text-[#888]'}>
                {ing.amount ? `${ing.amount} ${ing.unit} ` : ''}{ing.name}
              </span>
              {ing.in_pantry && (
                <span className="text-[10px] text-emerald-500 font-medium ml-auto">IN PANTRY</span>
              )}
              {ing.is_from_product && !ing.in_pantry && (
                <span className="text-[10px] text-violet-400 font-medium ml-auto">IN PRODUCT</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionFlagsSection({ conditionScore }) {
  const [expanded, setExpanded] = useState(false);
  const cs = conditionScore;
  const CONDITION_ICONS = { thyroid: '\uD83E\uDD8B', diabetes: '\uD83E\uDE78', heart: '\u2764\uFE0F', kidney: '\uD83E\uDED8', celiac: '\uD83C\uDF3E' };
  const SEVERITY_ICONS = { good: '\u2705', warn: '\u26A0\uFE0F', avoid: '\uD83D\uDEAB' };

  return (
    <div className="bg-[#111] rounded-sm overflow-hidden border border-[#2a2a2a]">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 text-left">
        <div className="flex items-center gap-2">
          <span>{CONDITION_ICONS[cs.slug] || ''}</span>
          <span className="text-sm font-medium text-[#ccc]">
            Why this {cs.label} score?
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#888]" /> : <ChevronDown className="w-4 h-4 text-[#888]" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-[#2a2a2a] pt-2">
          {cs.flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0 mt-0.5">{SEVERITY_ICONS[flag.severity] || ''}</span>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${
                  flag.severity === 'avoid' ? 'text-red-400' :
                  flag.severity === 'warn' ? 'text-amber-400' :
                  'text-green-400'
                }`}>
                  {flag.ingredient || flag.nutrient || ''}
                </p>
                <p className="text-xs text-[#888]">{flag.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onClick }) {
  const hasPantryData = recipe.pantry_total_count > 0;
  const healthBenefits = Array.isArray(recipe.health_benefits) ? recipe.health_benefits : [];

  return (
    <button onClick={onClick} className="w-full p-4 bg-violet-50 rounded-sm text-left card-pressed">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[#f4f4f0]">{recipe.name}</h4>
          <p className="text-sm text-[#888]">
            {recipe.total_time_minutes || recipe.prep_time_minutes || '?'} min
            {recipe.difficulty ? ` • ${recipe.difficulty}` : ''}
            {recipe.servings ? ` • ${recipe.servings} servings` : ''}
          </p>
        </div>
        <ChefHat className="w-6 h-6 text-violet-500 flex-shrink-0" />
      </div>

      {/* Pantry ingredient match */}
      {hasPantryData && recipe.pantry_have_count > 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">
            You have {recipe.pantry_have_count} of {recipe.pantry_total_count} ingredients
          </span>
          {recipe.pantry_need_count > 0 && (
            <span className="text-xs text-[#666]">
              • need {recipe.pantry_need_count} more
            </span>
          )}
        </div>
      )}

      {/* Health benefits preview */}
      {healthBenefits.length > 0 && (
        <div className="flex items-start gap-1.5 mt-2">
          <Leaf className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-green-400/80 line-clamp-2">
            {healthBenefits[0]}
          </p>
        </div>
      )}

      {recipe.vs_store_bought && (
        <p className="text-xs text-violet-600 mt-2 line-clamp-2">{recipe.vs_store_bought}</p>
      )}

      {/* Cost savings */}
      {recipe.cost_per_serving && (
        <p className="text-[10px] text-[#666] mt-1.5">
          ~${recipe.cost_per_serving.toFixed ? recipe.cost_per_serving.toFixed(2) : recipe.cost_per_serving}/serving homemade
        </p>
      )}
    </button>
  );
}
