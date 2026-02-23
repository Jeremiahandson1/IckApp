import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

/**
 * FamilyProfileSwitcher
 * 
 * Horizontal scrollable pill bar showing family members.
 * Tapping a profile changes which allergens are active for product warnings.
 * Shows "Scanning for [name]" with their allergen list.
 * 
 * For anonymous users: shows "Everyone" using localStorage allergens.
 * For logged-in users with no family profiles: shows "You" with account allergens.
 * For logged-in users with family profiles: shows all profiles with avatars.
 */

// Local state for active profile — persists across product views in same session
let _activeProfileId = null;

export function getActiveProfileId() {
  return _activeProfileId;
}

export default function FamilyProfileSwitcher({ onAllergenChange }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(_activeProfileId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, [user]);

  const loadProfiles = async () => {
    if (!user) {
      // Anonymous: single "Everyone" profile from localStorage
      const allergens = (() => {
        try { return JSON.parse(localStorage.getItem('ick_allergens') || '[]'); } catch { return []; }
      })();
      const anonProfile = { id: 'anon', name: 'Everyone', avatar: '👥', allergen_alerts: allergens };
      setProfiles([anonProfile]);
      if (!activeId) {
        setActiveId('anon');
        _activeProfileId = 'anon';
      }
      onAllergenChange?.(allergens);
      return;
    }

    try {
      setLoading(true);
      const data = await api.get('/products/family');
      if (Array.isArray(data) && data.length > 0) {
        setProfiles(data);
        
        // Default to first profile (the default one) if no selection
        const selectedId = activeId || data.find(p => p.is_default)?.id || data[0].id;
        setActiveId(selectedId);
        _activeProfileId = selectedId;
        
        const selected = data.find(p => p.id === selectedId) || data[0];
        onAllergenChange?.(selected.allergen_alerts || []);
      } else {
        // No family profiles — use account allergens
        const fallback = { id: 'me', name: user.name || 'Me', avatar: '👤', allergen_alerts: user.allergen_alerts || [] };
        setProfiles([fallback]);
        setActiveId('me');
        _activeProfileId = 'me';
        onAllergenChange?.(user.allergen_alerts || []);
      }
    } catch (err) {
      // Offline fallback — use account allergens
      const fallback = { id: 'me', name: user.name || 'Me', avatar: '👤', allergen_alerts: user.allergen_alerts || [] };
      setProfiles([fallback]);
      setActiveId('me');
      _activeProfileId = 'me';
      onAllergenChange?.(user.allergen_alerts || []);
    } finally {
      setLoading(false);
    }
  };

  const selectProfile = (profile) => {
    setActiveId(profile.id);
    _activeProfileId = profile.id;
    onAllergenChange?.(profile.allergen_alerts || []);
  };

  // Don't show if only one profile with no allergens
  if (profiles.length <= 1 && (!profiles[0]?.allergen_alerts?.length)) {
    return null;
  }

  // Don't show if only one profile (no family to switch between)
  if (profiles.length <= 1) return null;

  return (
    <div className="px-4 mt-3">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
        <span className="text-xs text-[#888] font-medium whitespace-nowrap mr-1">
          Scanning for:
        </span>
        {profiles.map((profile) => {
          const isActive = profile.id === activeId;
          const hasAllergens = profile.allergen_alerts?.length > 0;

          return (
            <button
              key={profile.id}
              onClick={() => selectProfile(profile)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[rgba(200,241,53,0.1)] text-[#a8cc20] ring-2 ring-orange-400 scale-105'
                  : 'bg-[#1e1e1e] text-[#888]'
              }`}
            >
              <span className="text-base">{profile.avatar}</span>
              <span>{profile.name}</span>
              {hasAllergens && (
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-400' : 'bg-red-300'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
