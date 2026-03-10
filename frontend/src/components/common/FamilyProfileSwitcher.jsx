import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { familyGroup as familyGroupApi } from '../../utils/api';

/**
 * FamilyProfileSwitcher
 *
 * Horizontal scrollable pill bar showing family members.
 * Tapping a profile changes which allergens are active for product warnings.
 * Shows "Scanning for [name]" with their allergen list.
 *
 * Supports two sources:
 *   1. Family profiles (per-account, /products/family) — original behavior
 *   2. Family group members (multi-user, /family/group) — new family groups
 *
 * When family group exists, adds a "Whole Family" option that aggregates
 * all members' allergies and reports per-member matches via onFamilyScanInfo.
 */

// Local state for active profile — persists across product views in same session
let _activeProfileId = null;
let _scanMode = 'member'; // 'member' | 'family'

export function getActiveProfileId() {
  return _activeProfileId;
}

export function getScanMode() {
  return _scanMode;
}

export default function FamilyProfileSwitcher({ onAllergenChange, onFamilyScanInfo }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [activeId, setActiveId] = useState(_activeProfileId);
  const [scanMode, setScanModeState] = useState(_scanMode);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, [user]);

  const loadProfiles = async () => {
    if (!user) {
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

      // Load both family profiles and family group in parallel
      const [profileData, groupData] = await Promise.all([
        api.get('/products/family').catch(() => []),
        familyGroupApi.getGroup().catch(() => ({ group: null, members: [] })),
      ]);

      let allProfiles = [];

      if (Array.isArray(profileData) && profileData.length > 0) {
        allProfiles = profileData;
      } else {
        allProfiles = [{ id: 'me', name: user.name || 'Me', avatar: '👤', allergen_alerts: user.allergen_alerts || [] }];
      }

      // If user has a family group, add member profiles for "Whole Family" mode
      if (groupData.group && groupData.members?.length > 0) {
        const fMembers = groupData.members
          .filter(m => m.status === 'active')
          .map(m => ({
            id: `fg-${m.id}`,
            name: m.user_name || m.profiles?.[0]?.name || 'Member',
            allergies: m.profiles?.[0]?.allergies || [],
            diseases: m.profiles?.[0]?.diseases || [],
          }));
        setFamilyMembers(fMembers);
      }

      setProfiles(allProfiles);

      const selectedId = activeId || allProfiles.find(p => p.is_default)?.id || allProfiles[0].id;
      setActiveId(selectedId);
      _activeProfileId = selectedId;

      if (scanMode === 'family') {
        emitFamilyAllergens(allProfiles);
      } else {
        const selected = allProfiles.find(p => p.id === selectedId) || allProfiles[0];
        onAllergenChange?.(selected.allergen_alerts || []);
      }
    } catch {
      const fallback = { id: 'me', name: user.name || 'Me', avatar: '👤', allergen_alerts: user.allergen_alerts || [] };
      setProfiles([fallback]);
      setActiveId('me');
      _activeProfileId = 'me';
      onAllergenChange?.(user.allergen_alerts || []);
    } finally {
      setLoading(false);
    }
  };

  const emitFamilyAllergens = (profs) => {
    // Aggregate all allergens from all profiles + family members
    const allAllergens = new Set();
    profs.forEach(p => (p.allergen_alerts || []).forEach(a => allAllergens.add(a)));
    familyMembers.forEach(m => (m.allergies || []).forEach(a => allAllergens.add(a)));
    onAllergenChange?.([...allAllergens]);
    onFamilyScanInfo?.(familyMembers);
  };

  const selectProfile = (profile) => {
    setActiveId(profile.id);
    _activeProfileId = profile.id;
    setScanModeState('member');
    _scanMode = 'member';
    onAllergenChange?.(profile.allergen_alerts || []);
    onFamilyScanInfo?.(null);
  };

  const selectWholeFamily = () => {
    setScanModeState('family');
    _scanMode = 'family';
    setActiveId('whole-family');
    _activeProfileId = 'whole-family';
    emitFamilyAllergens(profiles);
  };

  // Don't show if only one profile with no allergens and no family group members
  if (profiles.length <= 1 && (!profiles[0]?.allergen_alerts?.length) && familyMembers.length === 0) {
    return null;
  }

  // Don't show if only one profile and no family members
  if (profiles.length <= 1 && familyMembers.length === 0) return null;

  const hasFamilyGroup = familyMembers.length > 0;

  return (
    <div className="px-4 mt-3">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
        <span className="text-xs text-[#888] font-medium whitespace-nowrap mr-1">
          Scanning for:
        </span>

        {/* Whole Family toggle (only if family group exists) */}
        {hasFamilyGroup && (
          <button
            onClick={selectWholeFamily}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              scanMode === 'family'
                ? 'bg-[rgba(200,241,53,0.1)] text-[#a8cc20] ring-2 ring-orange-400 scale-105'
                : 'bg-[#1e1e1e] text-[#888]'
            }`}
          >
            <span className="text-base">👨‍👩‍👧‍👦</span>
            <span>Whole Family</span>
          </button>
        )}

        {profiles.map((profile) => {
          const isActive = profile.id === activeId && scanMode === 'member';
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
