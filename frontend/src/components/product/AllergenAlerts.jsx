// Allergen alerts — family profile switcher, personal-match red alert,
// general allergen list, and affected-family-member callouts.

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import FamilyProfileSwitcher from '../common/FamilyProfileSwitcher';

export default function AllergenAlerts({
  allergens, activeAllergens, familyScanMembers,
  onAllergenChange, onFamilyScanInfo,
}) {
  const matchedAllergens = allergens.filter(a =>
    activeAllergens.some(ua =>
      a.toLowerCase().includes(ua.toLowerCase()) ||
      ua.toLowerCase().includes(a.toLowerCase())
    )
  );
  const hasPersonalMatch = matchedAllergens.length > 0;

  return (
    <div className="mt-4 space-y-3">
      {/* Family profile switcher — lets user switch who they're scanning for */}
      <FamilyProfileSwitcher onAllergenChange={onAllergenChange} onFamilyScanInfo={onFamilyScanInfo} />

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
}
