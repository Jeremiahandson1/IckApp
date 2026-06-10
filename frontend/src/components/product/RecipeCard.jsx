// One make-it-at-home recipe card: time/difficulty, pantry ingredient match,
// health benefits, and cost per serving.

import { ChefHat, Check, Leaf } from 'lucide-react';

export default function RecipeCard({ recipe, onClick }) {
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
