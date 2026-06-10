// Nutrition Facts (per 100g) — collapsible grid with warn/good markers.

import { Apple } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

export default function NutritionFactsSection({ nutritionFacts, expanded, onToggle }) {
  return (
    <div className="px-4 mt-4">
      <CollapsibleSection
        title="Nutrition Facts"
        subtitle="per 100g"
        icon={Apple}
        iconColor="text-blue-500"
        expanded={expanded}
        onToggle={onToggle}
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
