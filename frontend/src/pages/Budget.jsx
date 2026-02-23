import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, Heart,
  Receipt, ChevronRight, BarChart3, Loader
} from 'lucide-react';
import api from '../utils/api';

export default function Budget() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [healthCost, setHealthCost] = useState(null);
  const [topItems, setTopItems] = useState(null);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [period]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sum, health, items] = await Promise.all([
        api.get(`/receipts/budget/summary?period=${period}`),
        api.get('/receipts/budget/health-cost').catch(() => null),
        api.get('/receipts/budget/items?limit=8').catch(() => null)
      ]);
      setSummary(sum);
      setHealthCost(health);
      setTopItems(items);
    } catch { /* empty state handled below */ }
    setLoading(false);
  };

  const categoryIcons = {
    produce: '🥬', dairy: '🧀', meat: '🥩', bakery: '🍞',
    snacks: '🍿', beverages: '🥤', frozen: '🧊', pantry_staple: '🥫',
    household: '🧹', personal_care: '🧴', other: '📦'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-6 h-6 text-[#c8f135] animate-spin" />
      </div>
    );
  }

  // Empty state
  if (!summary || summary.receipt_count === 0) {
    return (
      <div className="pb-4">
        <h1 className="text-xl font-bold text-[#f4f4f0] mb-4">Budget</h1>
        <div className="bg-[#0d0d0d] rounded-sm p-8 text-center space-y-4">
          <DollarSign className="w-12 h-12 mx-auto text-[#555]" />
          <p className="text-[#888]">No receipts scanned yet</p>
          <p className="text-sm text-[#666]">Scan your grocery receipts to track spending and get budget insights.</p>
          <button
            onClick={() => navigate('/receipt')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#c8f135] text-white rounded-sm font-medium"
          >
            <Receipt className="w-4 h-4" />
            Scan a Receipt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#f4f4f0]">Budget</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-1.5 bg-[#1e1e1e] border border-[#333] rounded-sm text-sm text-[#ddd] focus:outline-none"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0d0d0d] rounded-sm p-3 text-center">
          <p className="text-xl font-bold text-emerald-400">${summary.total_spent?.toFixed(2)}</p>
          <p className="text-xs text-[#666]">Total Spent</p>
        </div>
        <div className="bg-[#0d0d0d] rounded-sm p-3 text-center">
          <p className="text-xl font-bold text-[#f4f4f0]">${summary.avg_per_trip?.toFixed(2)}</p>
          <p className="text-xs text-[#666]">Per Trip</p>
        </div>
        <div className="bg-[#0d0d0d] rounded-sm p-3 text-center">
          <p className="text-xl font-bold text-[#f4f4f0]">{summary.receipt_count}</p>
          <p className="text-xs text-[#666]">Trips</p>
        </div>
      </div>

      {/* Weekly trend */}
      {summary.weekly_trend?.length > 1 && (
        <div className="bg-[#0d0d0d] rounded-sm p-4">
          <p className="text-sm font-medium text-[#bbb] mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#c8f135]" />
            Weekly Spending
          </p>
          <div className="flex items-end gap-2 h-24">
            {summary.weekly_trend.map((week, i) => {
              const maxWeek = Math.max(...summary.weekly_trend.map(w => parseFloat(w.total_spent)));
              const pct = maxWeek > 0 ? (parseFloat(week.total_spent) / maxWeek * 100) : 0;
              const dateStr = new Date(week.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-[#888]">${parseFloat(week.total_spent).toFixed(0)}</span>
                  <div className="w-full bg-[#1e1e1e] rounded-t relative" style={{ height: '64px' }}>
                    <div 
                      className="absolute bottom-0 w-full bg-emerald-500/60 rounded-t transition-all"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#555]">{dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Health cost analysis */}
      {healthCost && healthCost.by_health_tier?.length > 0 && (
        <div className="bg-[#0d0d0d] rounded-sm p-4">
          <p className="text-sm font-medium text-[#bbb] mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-400" />
            Health vs Cost
          </p>
          <div className="space-y-2">
            {healthCost.by_health_tier.map((tier, i) => {
              const totalAll = healthCost.by_health_tier.reduce((s, t) => s + parseFloat(t.total_spent), 0);
              const pct = totalAll > 0 ? (parseFloat(tier.total_spent) / totalAll * 100) : 0;
              const colors = {
                healthy: { bar: 'bg-green-500', text: 'text-green-400', label: 'Healthy (70+)' },
                moderate: { bar: 'bg-yellow-500', text: 'text-yellow-400', label: 'Moderate (40-69)' },
                unhealthy: { bar: 'bg-red-500', text: 'text-red-400', label: 'Unhealthy (<40)' }
              };
              const c = colors[tier.health_tier] || colors.moderate;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-xs ${c.text} w-28`}>{c.label}</span>
                  <div className="flex-1 bg-[#1e1e1e] rounded-full h-3">
                    <div className={`${c.bar} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-[#bbb] w-20 text-right">
                    ${parseFloat(tier.total_spent).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
          {healthCost.insight && (
            <p className="text-xs text-[#666] mt-3 italic">{healthCost.insight}</p>
          )}
        </div>
      )}

      {/* Category breakdown */}
      {summary.by_category?.length > 0 && (
        <div className="bg-[#0d0d0d] rounded-sm p-4">
          <p className="text-sm font-medium text-[#bbb] mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            By Category
          </p>
          <div className="space-y-2">
            {summary.by_category.map((cat, i) => {
              const maxSpend = parseFloat(summary.by_category[0].total);
              const pct = maxSpend > 0 ? (parseFloat(cat.total) / maxSpend * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-lg w-7">{categoryIcons[cat.category] || '📦'}</span>
                  <span className="text-xs text-[#888] w-24 truncate capitalize">{cat.category?.replace('_', ' ')}</span>
                  <div className="flex-1 bg-[#1e1e1e] rounded-full h-2.5">
                    <div className="bg-blue-500/60 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-[#bbb] w-16 text-right">${parseFloat(cat.total).toFixed(2)}</span>
                  <span className="text-xs text-[#555] w-10 text-right">{cat.item_count}×</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top items by spend */}
      {topItems?.top_items?.length > 0 && (
        <div className="bg-[#0d0d0d] rounded-sm p-4">
          <p className="text-sm font-medium text-[#bbb] mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            Top Items by Spend
          </p>
          <div className="space-y-2">
            {topItems.top_items.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#ddd] truncate">{item.product_name || item.item_name}</p>
                  <p className="text-xs text-[#666]">{item.purchase_count}× purchased, avg ${parseFloat(item.avg_price).toFixed(2)}</p>
                </div>
                <p className="text-sm font-bold text-[#f4f4f0] ml-3">${parseFloat(item.total_spent).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top stores */}
      {summary.top_stores?.length > 0 && (
        <div className="bg-[#0d0d0d] rounded-sm p-4">
          <p className="text-sm font-medium text-[#bbb] mb-3">Stores</p>
          <div className="space-y-2">
            {summary.top_stores.map((store, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-[#bbb]">{store.store_name || 'Unknown'}</span>
                <div className="text-right">
                  <span className="text-sm font-medium text-[#f4f4f0]">${parseFloat(store.total_spent).toFixed(2)}</span>
                  <span className="text-xs text-[#666] ml-2">{store.visits} trips</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan another */}
      <button
        onClick={() => navigate('/receipt')}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[rgba(200,241,53,0.06)] text-[#c8f135] rounded-sm font-medium"
      >
        <Receipt className="w-4 h-4" />
        Scan a Receipt
      </button>
    </div>
  );
}
