import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkedSteps, setCheckedSteps] = useState(new Set());
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    try {
      const res = await api.get(`/recipes/${id}`);
      // api.get might return error objects without throwing
      if (!res || res.error || !res.name) {
        throw new Error(res?.error || 'Recipe not found');
      }
      setRecipe(res);
    } catch (err) {
      console.error('Recipe load error:', err);
      showToast('Recipe not found', 'error');
      navigate('/recipes');
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = (index) => {
    const newChecked = new Set(checkedSteps);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedSteps(newChecked);

    // If all steps complete, show rating
    if (recipe?.instructions && newChecked.size === recipe.instructions.length) {
      setShowRating(true);
    }
  };

  const submitMadeIt = async () => {
    if (rating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/recipes/${id}/made`, { rating });
      showToast('Thanks for your feedback!', 'success');
      setShowRating(false);
    } catch (err) {
      showToast('Failed to save', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-500/20 text-green-700';
      case 'medium': return 'bg-yellow-500/20 text-yellow-700';
      case 'hard': return 'bg-red-500/20 text-red-700';
      default: return 'bg-[#1e1e1e] text-[#bbb]';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#c8f135] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🍳</div>
        <h2 className="text-xl font-semibold text-[#f4f4f0] mb-2">Recipe not found</h2>
        <button onClick={() => navigate('/recipes')} className="text-[#c8f135] mt-2">
          ← Browse all recipes
        </button>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[#888] mb-4"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <h1 className="text-xl font-bold text-[#f4f4f0] mb-2">{recipe.name}</h1>
        
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#666] mb-3">
          <span>⏱ {recipe.prep_time_minutes} prep + {recipe.total_time_minutes - recipe.prep_time_minutes} cook</span>
          <span>•</span>
          <span>🍽 {recipe.servings} servings</span>
          <span>•</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${getDifficultyColor(recipe.difficulty)}`}>
            {recipe.difficulty}
          </span>
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-[#888] text-sm mb-3">{recipe.description}</p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {recipe.kid_friendly && (
            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">
              👶 Kid Friendly
            </span>
          )}
          {recipe.dietary_tags?.map(tag => (
            <span key={tag} className="px-2 py-1 bg-[#1e1e1e] text-[#888] text-xs rounded-full">
              {tag}
            </span>
          ))}
          {recipe.allergens?.map(allergen => (
            <span key={allergen} className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full">
              ⚠️ {allergen}
            </span>
          ))}
        </div>
      </div>

      {/* Cost & Health Benefits */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {recipe.estimated_cost && (
          <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm">
            <div className="text-2xl font-bold text-[#c8f135]">${recipe.estimated_cost.toFixed(2)}</div>
            <div className="text-xs text-[#666]">Per Batch</div>
          </div>
        )}
        {recipe.health_benefits && (
          <div className="bg-[rgba(200,241,53,0.06)] rounded-sm p-4">
            <div className="text-sm text-[#7a8e00]">{recipe.health_benefits}</div>
          </div>
        )}
      </div>

      {/* vs Store Bought */}
      {recipe.vs_store_bought && (
        <div className="bg-gradient-to-r from-orange-50 to-green-50 rounded-sm p-4 mb-4">
          <h3 className="font-semibold text-[#a8cc20] mb-1">Why Homemade is Better</h3>
          <p className="text-sm text-[#7a8e00]">{recipe.vs_store_bought}</p>
        </div>
      )}

      {/* Ingredients */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <h2 className="font-semibold text-[#f4f4f0] mb-3">Ingredients</h2>
        <ul className="space-y-2">
          {recipe.ingredients?.map((ingredient, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <span className="w-5 h-5 rounded-full bg-[rgba(200,241,53,0.1)] text-[#c8f135] flex items-center justify-center flex-shrink-0 text-xs">
                {index + 1}
              </span>
              <span className="text-[#bbb]">
                <strong>{ingredient.amount} {ingredient.unit}</strong> {ingredient.item}
                {ingredient.notes && <span className="text-[#888]"> ({ingredient.notes})</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Instructions */}
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
        <h2 className="font-semibold text-[#f4f4f0] mb-3">Instructions</h2>
        <ol className="space-y-4">
          {recipe.instructions?.map((step, index) => (
            <li 
              key={index}
              className={`flex gap-3 cursor-pointer transition-opacity ${
                checkedSteps.has(index) ? 'opacity-50' : ''
              }`}
              onClick={() => toggleStep(index)}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium ${
                checkedSteps.has(index) 
                  ? 'bg-[rgba(200,241,53,0.06)] text-white' 
                  : 'bg-[#2a2a2a] text-[#888]'
              }`}>
                {checkedSteps.has(index) ? '✓' : index + 1}
              </span>
              <span className={`text-sm text-[#bbb] ${checkedSteps.has(index) ? 'line-through' : ''}`}>
                {step}
              </span>
            </li>
          ))}
        </ol>

        {/* Progress */}
        {recipe.instructions?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
            <div className="flex items-center justify-between text-sm text-[#666] mb-2">
              <span>Progress</span>
              <span>{checkedSteps.size} of {recipe.instructions.length}</span>
            </div>
            <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[rgba(200,241,53,0.06)] transition-all duration-300"
                style={{ width: `${(checkedSteps.size / recipe.instructions.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Made It Button */}
      <div className="fixed bottom-20 left-4 right-4">
        <button
          onClick={() => setShowRating(true)}
          className="w-full py-4 bg-[rgba(200,241,53,0.06)] text-white rounded-sm font-semibold shadow-lg"
        >
          I Made This! 🎉
        </button>
      </div>

      {/* Rating Modal */}
      {showRating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d0d0d] rounded-sm p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-center mb-4">How was it?</h2>
            
            {/* Star Rating */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-3xl"
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRating(false)}
                className="flex-1 py-3 bg-[#1e1e1e] text-[#888] rounded-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={submitMadeIt}
                disabled={submitting || rating === 0}
                className="flex-1 py-3 bg-[rgba(200,241,53,0.06)] text-white rounded-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
