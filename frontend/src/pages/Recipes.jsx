import { SkeletonRecipeCard } from '../components/common/Skeleton';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { recipes as recipesApi } from '../utils/api';
import { useToast } from '../contexts/ToastContext';

const TABS = [
  { id: 'curated',  label: 'Curated Swaps',   sub: 'Replace processed favorites' },
  { id: 'browse',   label: 'Browse',          sub: 'Search all recipes' },
  { id: 'pantry',   label: 'From Pantry',     sub: 'Cook what you have' },
];

const PAGE_SIZE = 50;

export default function Recipes() {
  const [tab, setTab] = useState('curated');
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [spoonacularDown, setSpoonacularDown] = useState(false);

  // Curated-tab filters
  const [filter, setFilter] = useState({
    category: '', difficulty: '', maxTime: '', kidFriendly: false
  });

  // Browse-tab state
  const [searchQ, setSearchQ] = useState('');
  const [searchDiet, setSearchDiet] = useState('');

  const { showToast } = useToast();

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get('/recipes/meta/categories');
      setCategories(Array.isArray(res) ? res : []);
    } catch { /* non-critical */ }
  };

  // ── Tab: Curated ──
  // Build the filter-only param string used by both list + count endpoints.
  const buildCuratedParams = () => {
    const p = new URLSearchParams();
    if (filter.category)   p.append('category', filter.category);
    if (filter.difficulty) p.append('difficulty', filter.difficulty);
    if (filter.maxTime)    p.append('max_time', filter.maxTime);
    if (filter.kidFriendly) p.append('kid_friendly', 'true');
    return p;
  };

  const loadCurated = async () => {
    setLoading(true);
    try {
      const params = buildCuratedParams();
      params.append('limit', String(PAGE_SIZE));
      params.append('offset', '0');
      const [res, countRes] = await Promise.all([
        api.get(`/recipes?${params.toString()}`),
        api.get(`/recipes/meta/count?${buildCuratedParams().toString()}`).catch(() => null),
      ]);
      const list = Array.isArray(res) ? res : [];
      setRecipes(list);
      setHasMore(list.length === PAGE_SIZE);
      setTotalCount(countRes?.total ?? null);
    } catch {
      showToast('Failed to load recipes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreCurated = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = buildCuratedParams();
      params.append('limit', String(PAGE_SIZE));
      params.append('offset', String(recipes.length));
      const res = await api.get(`/recipes?${params.toString()}`);
      const list = Array.isArray(res) ? res : [];
      setRecipes(prev => [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
    } catch {
      showToast('Failed to load more', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Tab: Browse (Spoonacular search) ──
  const loadBrowse = async () => {
    setLoading(true);
    setSpoonacularDown(false);
    try {
      const res = await recipesApi.spoonacularSearch({
        q: searchQ,
        diet: searchDiet,
        number: 24,
      });
      setRecipes(Array.isArray(res?.recipes) ? res.recipes : []);
    } catch (err) {
      if (err?.status === 503) {
        setSpoonacularDown(true);
      } else {
        showToast('Search failed', 'error');
      }
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Tab: From Pantry ──
  const loadFromPantry = async () => {
    setLoading(true);
    setSpoonacularDown(false);
    try {
      const res = await recipesApi.spoonacularFromPantry(10);
      setRecipes(Array.isArray(res?.recipes) ? res.recipes : []);
      if (res?.reason === 'pantry_too_small') {
        showToast(res.message || 'Add more pantry items first', 'info');
      }
    } catch (err) {
      if (err?.status === 503) {
        setSpoonacularDown(true);
      } else {
        showToast('Could not load pantry recipes', 'error');
      }
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'curated')      loadCurated();
    else if (tab === 'pantry')  loadFromPantry();
    else if (tab === 'browse')  setRecipes([]); // browse waits for user search
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'curated') loadCurated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy':   return 'bg-green-500/20 text-green-700';
      case 'medium': return 'bg-yellow-500/20 text-yellow-700';
      case 'hard':   return 'bg-red-500/20 text-red-700';
      default:       return 'bg-[#1e1e1e] text-[#bbb]';
    }
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#f4f4f0]">Recipes</h1>
        <p className="text-sm text-[#666]">
          {TABS.find(t => t.id === tab)?.sub}
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-4 bg-[#0d0d0d] rounded-sm p-1 border border-[#2a2a2a]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-2 rounded-sm text-xs font-medium transition-colors ${
              tab === t.id
                ? 'bg-[rgba(200,241,53,0.08)] text-[#c8f135]'
                : 'text-[#666] hover:text-[#bbb]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Spoonacular unavailable banner */}
      {spoonacularDown && (
        <div className="bg-[#1e1410] border border-amber-900/30 rounded-sm p-3 mb-3 text-xs text-amber-300">
          Recipe search is temporarily unavailable. The curated swaps tab still works.
        </div>
      )}

      {/* CURATED TAB */}
      {tab === 'curated' && (
        <>
          <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={filter.category}
                onChange={(e) => setFilter(p => ({ ...p, category: e.target.value }))}
                className="px-3 py-2 border border-[#333] bg-[#0d0d0d] text-[#ddd] rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
              >
                <option value="">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select
                value={filter.difficulty}
                onChange={(e) => setFilter(p => ({ ...p, difficulty: e.target.value }))}
                className="px-3 py-2 border border-[#333] bg-[#0d0d0d] text-[#ddd] rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
              >
                <option value="">Any Difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <select
                value={filter.maxTime}
                onChange={(e) => setFilter(p => ({ ...p, maxTime: e.target.value }))}
                className="px-3 py-2 border border-[#333] bg-[#0d0d0d] text-[#ddd] rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
              >
                <option value="">Any Time</option>
                <option value="15">Under 15 min</option>
                <option value="30">Under 30 min</option>
                <option value="60">Under 1 hour</option>
              </select>
              <button
                onClick={() => setFilter(p => ({ ...p, kidFriendly: !p.kidFriendly }))}
                className={`px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                  filter.kidFriendly
                    ? 'bg-[rgba(200,241,53,0.06)] text-white'
                    : 'border border-[#333] text-[#888]'
                }`}
              >
                👶 Kid Friendly
              </button>
            </div>
            {(filter.category || filter.difficulty || filter.maxTime || filter.kidFriendly) && (
              <button
                onClick={() => setFilter({ category: '', difficulty: '', maxTime: '', kidFriendly: false })}
                className="mt-3 text-sm text-[#c8f135]"
              >
                Clear Filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 p-4">
              {[1,2,3,4].map(i => <SkeletonRecipeCard key={i} />)}
            </div>
          ) : recipes.length === 0 ? (
            <EmptyState icon="🍳" title="No curated recipes match" body="Try adjusting your filters." />
          ) : (
            <>
              <p className="text-sm text-[#666] mb-3">
                Showing {recipes.length}
                {totalCount != null && totalCount !== recipes.length && ` of ${totalCount}`}
                {' '}recipe{recipes.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-3">
                {recipes.map(recipe => (
                  <CuratedCard key={recipe.id} recipe={recipe} getDifficultyColor={getDifficultyColor} />
                ))}
              </div>
              {hasMore && (
                <button
                  onClick={loadMoreCurated}
                  disabled={loadingMore}
                  className="w-full mt-4 py-3 bg-[rgba(200,241,53,0.08)] border border-[#c8f135]/30 text-[#c8f135] rounded-sm text-sm font-medium disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : `Load more (${totalCount != null ? totalCount - recipes.length : 'more'} remaining)`}
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* BROWSE TAB */}
      {tab === 'browse' && (
        <>
          <div className="bg-[#0d0d0d] rounded-sm p-4 mb-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadBrowse()}
                placeholder="Search recipes (e.g. salmon, pasta, breakfast)..."
                className="flex-1 px-3 py-2 bg-[#1e1e1e] border border-[#333] rounded-sm text-sm text-[#ddd] placeholder:text-[#555] focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
              />
              <button
                onClick={loadBrowse}
                disabled={loading}
                className="px-4 py-2 bg-[#c8f135] text-[#0a0a0a] rounded-sm text-sm font-bold disabled:opacity-50"
              >
                Search
              </button>
            </div>
            <select
              value={searchDiet}
              onChange={(e) => setSearchDiet(e.target.value)}
              className="w-full px-3 py-2 border border-[#333] bg-[#0d0d0d] text-[#ddd] rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
            >
              <option value="">Any Diet</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="gluten free">Gluten-Free</option>
              <option value="dairy free">Dairy-Free</option>
              <option value="ketogenic">Keto</option>
              <option value="paleo">Paleo</option>
            </select>
            <p className="text-[10px] text-[#555]">Powered by Spoonacular</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 p-4">
              {[1,2,3,4].map(i => <SkeletonRecipeCard key={i} />)}
            </div>
          ) : recipes.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={searchQ ? 'No recipes match' : 'Type a search to begin'}
              body={searchQ ? 'Try different keywords or a different diet filter.' : 'e.g., "chicken stir fry" or "quick breakfast"'}
            />
          ) : (
            <div className="space-y-3">
              {recipes.map(recipe => <BrowseCard key={recipe.id} recipe={recipe} />)}
            </div>
          )}
        </>
      )}

      {/* FROM PANTRY TAB */}
      {tab === 'pantry' && (
        <>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 p-4">
              {[1,2,3,4].map(i => <SkeletonRecipeCard key={i} />)}
            </div>
          ) : recipes.length === 0 ? (
            <EmptyState
              icon="🥘"
              title="Nothing yet"
              body="Add at least 2 items to your pantry and we'll suggest recipes that use them. Scan a receipt to fill it fast."
            />
          ) : (
            <>
              <p className="text-sm text-[#666] mb-3">{recipes.length} recipes you can mostly make</p>
              <div className="space-y-3">
                {recipes.map(recipe => <PantryCard key={recipe.id} recipe={recipe} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body }) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-xl font-semibold text-[#f4f4f0] mb-2">{title}</h2>
      <p className="text-[#666] text-sm px-6">{body}</p>
    </div>
  );
}

const SOURCE_LABEL = {
  wikibooks: 'Wikibooks Cookbook',
  usda: 'USDA',
  themealdb: 'TheMealDB',
};

function CuratedCard({ recipe, getDifficultyColor }) {
  const isImported = recipe.source && recipe.source !== 'curated';
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="block bg-[#0d0d0d] rounded-sm p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-sm bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">👨‍🍳</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#f4f4f0] mb-1">{recipe.name}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#666] mb-2">
            <span>⏱ {recipe.total_time_minutes} min</span>
            <span>•</span>
            <span className={`px-2 py-0.5 rounded-full ${getDifficultyColor(recipe.difficulty)}`}>
              {recipe.difficulty}
            </span>
            {recipe.estimated_cost && (
              <>
                <span>•</span>
                <span>~${Number(recipe.estimated_cost).toFixed(2)}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {recipe.kid_friendly && (
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                👶 Kid Friendly
              </span>
            )}
            {recipe.replaces_category && (
              <span className="px-2 py-0.5 bg-[rgba(200,241,53,0.06)] text-[#c8f135] text-xs rounded-full">
                Replaces: {recipe.replaces_category}
              </span>
            )}
            {recipe.dietary_tags?.slice(0, 2).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-[#1e1e1e] text-[#888] text-xs rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      </div>
      {recipe.description && (
        <p className="mt-2 text-sm text-[#666] line-clamp-2">{recipe.description}</p>
      )}
      {recipe.vs_store_bought && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
          <p className="text-xs text-[#c8f135]">💚 {recipe.vs_store_bought}</p>
        </div>
      )}
      {isImported && (
        <p className="mt-2 text-[10px] text-[#555]">
          Source: {SOURCE_LABEL[recipe.source] || recipe.source}
          {recipe.source === 'wikibooks' && ' · CC BY-SA 4.0'}
        </p>
      )}
    </Link>
  );
}

function BrowseCard({ recipe }) {
  const dietBadges = [];
  if (recipe.vegan) dietBadges.push('Vegan');
  else if (recipe.vegetarian) dietBadges.push('Vegetarian');
  if (recipe.gluten_free) dietBadges.push('GF');
  if (recipe.dairy_free) dietBadges.push('DF');

  return (
    <a
      href={recipe.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#0d0d0d] rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex">
        {recipe.image && (
          <img
            src={recipe.image}
            alt={recipe.title}
            className="w-24 h-24 object-cover flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 p-3 min-w-0">
          <h3 className="font-semibold text-[#f4f4f0] text-sm mb-1 line-clamp-2">{recipe.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#666] mb-1">
            {recipe.ready_in_minutes && <span>⏱ {recipe.ready_in_minutes} min</span>}
            {recipe.servings && <><span>•</span><span>🍽 {recipe.servings}</span></>}
          </div>
          <div className="flex flex-wrap gap-1">
            {dietBadges.map(b => (
              <span key={b} className="px-2 py-0.5 bg-[#1e1e1e] text-[#888] text-[10px] rounded-full">{b}</span>
            ))}
            {recipe.cuisines?.slice(0, 1).map(c => (
              <span key={c} className="px-2 py-0.5 bg-[rgba(200,241,53,0.06)] text-[#c8f135] text-[10px] rounded-full">{c}</span>
            ))}
          </div>
        </div>
      </div>
    </a>
  );
}

function PantryCard({ recipe }) {
  const total = (recipe.have_count || 0) + (recipe.need_count || 0);
  const pct = total > 0 ? Math.round((recipe.have_count / total) * 100) : 0;
  return (
    <div className="bg-[#0d0d0d] rounded-sm overflow-hidden border border-[#2a2a2a]">
      <a
        href={`https://spoonacular.com/recipes/${(recipe.title || '').replace(/\s+/g, '-').toLowerCase()}-${recipe.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex"
      >
        {recipe.image && (
          <img
            src={recipe.image}
            alt={recipe.title}
            className="w-24 h-24 object-cover flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 p-3 min-w-0">
          <h3 className="font-semibold text-[#f4f4f0] text-sm mb-2 line-clamp-2">{recipe.title}</h3>
          <div className="flex items-center gap-3 text-xs text-[#888] mb-2">
            <span className="text-green-400">{recipe.have_count} have</span>
            <span className="text-amber-400">{recipe.need_count} need</span>
          </div>
          <div className="w-full h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c8f135] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </a>
      {recipe.ingredients?.length > 0 && (
        <details className="border-t border-[#1a1a1a]">
          <summary className="px-3 py-2 text-xs text-[#666] cursor-pointer hover:text-[#bbb]">
            View ingredients ({total})
          </summary>
          <div className="px-3 pb-3 space-y-1">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={ing.in_pantry ? 'text-green-400' : 'text-[#666]'}>
                  {ing.in_pantry ? '✓' : '○'}
                </span>
                <span className={ing.in_pantry ? 'text-[#ddd]' : 'text-[#888]'}>{ing.name}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
