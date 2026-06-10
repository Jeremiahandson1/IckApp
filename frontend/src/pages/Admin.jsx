// Admin console — sidebar shell. Each section lives in pages/admin/, sharing
// the primitives in pages/admin/shared.jsx for visual consistency. Every
// mutation fires a toast and is logged server-side to admin_actions.
//
// URL state: ?section=brands maps to active section, so back/forward works.

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users as UsersIcon, CreditCard, Inbox,
  ChefHat, Building2, Tag, ToggleLeft, History, Megaphone,
  Command as CommandIcon,
} from 'lucide-react';

import CommandPalette from './admin/CommandPalette';
import DashboardSection from './admin/DashboardSection';
import UsersSection from './admin/UsersSection';
import SubscriptionsSection from './admin/SubscriptionsSection';
import ContributionsSection from './admin/ContributionsSection';
import RecipesSection from './admin/RecipesSection';
import CompaniesSection from './admin/CompaniesSection';
import BrandsSection from './admin/BrandsSection';
import FlagsSection from './admin/FlagsSection';
import BroadcastSection from './admin/BroadcastSection';
import AuditSection from './admin/AuditSection';

const SECTIONS = [
  { key: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { key: 'users',         label: 'Users',          icon: UsersIcon },
  { key: 'subscriptions', label: 'Subscriptions',  icon: CreditCard },
  { key: 'contributions', label: 'Contributions',  icon: Inbox },
  { key: 'recipes',       label: 'Recipes',        icon: ChefHat },
  { key: 'companies',     label: 'Companies',      icon: Building2 },
  { key: 'brands',        label: 'Brand Aliases',  icon: Tag },
  { key: 'flags',         label: 'Feature Flags',  icon: ToggleLeft },
  { key: 'broadcast',     label: 'Broadcast',      icon: Megaphone },
  { key: 'audit',         label: 'Audit Log',      icon: History },
];

const SECTION_COMPONENTS = {
  dashboard:     DashboardSection,
  users:         UsersSection,
  subscriptions: SubscriptionsSection,
  contributions: ContributionsSection,
  recipes:       RecipesSection,
  companies:     CompaniesSection,
  brands:        BrandsSection,
  flags:         FlagsSection,
  broadcast:     BroadcastSection,
  audit:         AuditSection,
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = params.get('section') || 'dashboard';
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (user && !user.is_admin) navigate('/', { replace: true });
  }, [user, navigate]);

  // Global Cmd/Ctrl+K → open palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user?.is_admin) return null;

  const setSection = (key) => setParams({ section: key });
  const ActiveSection = SECTION_COMPONENTS[section] || DashboardSection;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f4f4f0] flex">
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onJump={setSection}
        sections={SECTIONS}
      />
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#0d0d0d] border-r border-[#1e1e1e] py-4">
        <div className="px-4 mb-6">
          <p className="text-xs text-[#666] font-mono uppercase tracking-wider">Ick Admin</p>
          <p className="text-sm text-[#bbb] mt-0.5">{user.email}</p>
        </div>
        <nav className="space-y-0.5">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = s.key === section;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-[rgba(200,241,53,0.08)] text-[#c8f135] border-l-2 border-[#c8f135]'
                    : 'text-[#888] hover:text-[#ddd] hover:bg-[#1a1a1a] border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
        <div className="px-4 mt-6 pt-4 border-t border-[#1e1e1e] space-y-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-2 text-xs text-[#666] hover:text-[#ddd]"
          >
            <CommandIcon className="w-3 h-3" />
            Quick jump
            <kbd className="ml-auto text-[10px] font-mono bg-[#1a1a1a] px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-[#666] hover:text-[#ddd]"
          >
            ← Back to app
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-6 max-w-[1400px]">
        <ActiveSection />
      </main>
    </div>
  );
}
