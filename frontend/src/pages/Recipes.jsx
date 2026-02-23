import { SkeletonRecipeCard } from '../components/common/Skeleton';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    category: '',
    difficulty: '',
    maxTime: '',
    kidFriendly: false
  });
  const { showToast } = useToast();

  useEffect(() => {
    loadRecipes();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get('/recipes/meta/categories');
      setCategories(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load categories');
    }
  };

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.category) params.append('category', filter.category);
      if (filter.difficulty) params.append('difficulty', filter.difficulty);
      if (filter.maxTime) params.append('max_time', filter.maxTime);
      if (filter.kidFriendly) params.append('kid_friendly', 'true');

      const res = await api.get(`/recipes?${params.toString()}`);
      setRecipes(Array.isArray(res) ? res : []);
    } catch (err) {
      showToast('Failed to load recipes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, [filter]);

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-500/20 text-green-700';
      case 'medium': return 'bg-yellow-500/20 text-yellow-700';
      case 'hard': return 'bg-red-500/20 text-red-700';
      default: return 'bg-[#1e1e1e] text-[#bbb]';
    }
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#f4f4f0]">Homemade Recipes</h1>
        <p className="text-sm text-[#666]">Healthier versions you can make at home</p>
      </div>

      {/* Filters */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Category */}
          <select
            value={filter.category}
            onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
            className="px-3 py-2 border border-[#333] rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Difficulty */}
          <select
            value={filter.difficulty}
            onChange={(e) => setFilter(prev => ({ ...prev, difficulty: e.target.value }))}
            className="px-3 py-2 border border-[#333] rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
          >
            <option value="">Any Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* Max Time */}
          <select
            value={filter.maxTime}
            onChange={(e) => setFilter(prev => ({ ...prev, maxTime: e.target.value }))}
            className="px-3 py-2 border border-[#333] rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
          >
            <option value="">Any Time</option>
            <option value="15">Under 15 min</option>
            <option value="30">Under 30 min</option>
            <option value="60">Under 1 hour</option>
          </select>

          {/* Kid Friendly */}
          <button
            onClick={() => setFilter(prev => ({ ...prev, kidFriendly: !prev.kidFriendly }))}
            className={`px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
              filter.kidFriendly 
                ? 'bg-[rgba(200,241,53,0.06)] text-white' 
                : 'border border-[#333] text-[#888]'
            }`}
          >
            👶 Kid Friendly
          </button>
        </div>

        {/* Clear Filters */}
        {(filter.category || filter.difficulty || filter.maxTime || filter.kidFriendly) && (
          <button
            onClick={() => setFilter({ category: '', difficulty: '', maxTime: '', kidFriendly: false })}
            className="mt-3 text-sm text-[#c8f135]"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 p-4">
          {[1,2,3,4].map(i => <SkeletonRecipeCard key={i} />)}
        </div>
      ) : (
        <>
          {/* Results Count */}
          <p className="text-sm text-[#666] mb-3">{recipes.length} recipes found</p>

          {/* Recipes Grid */}
          {recipes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🍳</div>
              <h2 className="text-xl font-semibold text-[#f4f4f0] mb-2">No recipes found</h2>
              <p className="text-[#666]">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recipes.map(recipe => (
                <Link
                  key={recipe.id}
                  to={`/recipes/${recipe.id}`}
                  className="block bg-[#0d0d0d] rounded-sm p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    {/* Recipe Icon */}
                    <div className="w-16 h-16 rounded-sm bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">👨‍🍳</span>
                    </div>

                    {/* Recipe Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#f4f4f0] mb-1">{recipe.name}</h3>
                      
                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#666] mb-2">
                        <span>⏱ {recipe.total_time_minutes} min</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-full ${getDifficultyColor(recipe.difficulty)}`}>
                          {recipe.difficulty}
                        </span>
                        {recipe.estimated_cost && (
                          <>
                            <span>•</span>
                            <span>~${recipe.estimated_cost.toFixed(2)}</span>
                          </>
                        )}
                      </div>

                      {/* Tags */}
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
                          <span key={tag} className="px-2 py-0.5 bg-[#1e1e1e] text-[#888] text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Description */}
                  {recipe.description && (
                    <p className="mt-2 text-sm text-[#666] line-clamp-2">{recipe.description}</p>
                  )}

                  {/* vs Store Bought */}
                  {recipe.vs_store_bought && (
                    <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                      <p className="text-xs text-[#c8f135]">
                        💚 {recipe.vs_store_bought}
                      </p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
