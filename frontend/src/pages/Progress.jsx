import { SkeletonList } from '../components/common/Skeleton';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { getScoreColor } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

export default function Progress() {
  const [dashboard, setDashboard] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, achieveRes] = await Promise.all([
        api.get('/progress/dashboard'),
        api.get('/progress/achievements')
      ]);
      setDashboard(dashRes);
      setAchievements(achieveRes.achievements || []);
    } catch (err) {
      toast.error('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4"><SkeletonList count={3} lines={2} /></div>;
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <h1 className="text-xl font-bold text-[#f4f4f0] mb-4">Your Progress</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'achievements', label: 'Achievements' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-[rgba(200,241,53,0.06)] text-white'
                : 'bg-[#1e1e1e] text-[#888]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <>
          {/* Health Score */}
          <div className="bg-gradient-to-br from-[#c8f135] to-green-600 rounded-sm p-6 text-white mb-4 shadow-lg">
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">{Math.round(dashboard.health_score)}</div>
              <div className="text-orange-100 mb-4">Health Score</div>
              
              <div className="flex justify-center gap-8 text-sm">
                <div>
                  <div className="text-2xl font-bold">{dashboard.pantry_stats?.total_items || 0}</div>
                  <div className="opacity-80">Items</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.swap_stats?.total_swaps || 0}</div>
                  <div className="opacity-80">Swaps</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.recipe_stats?.recipes_made || 0}</div>
                  <div className="opacity-80">Recipes</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pantry Breakdown */}
          {dashboard.pantry_stats?.breakdown && (
            <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
              <h2 className="font-semibold text-[#f4f4f0] mb-3">Pantry Breakdown</h2>
              <div className="space-y-3">
                {[
                  { label: 'Excellent', key: 'excellent', color: 'bg-[rgba(200,241,53,0.06)]', emoji: '🌟' },
                  { label: 'Good', key: 'good', color: 'bg-green-400', emoji: '🟢' },
                  { label: 'Okay', key: 'okay', color: 'bg-yellow-400', emoji: '🟡' },
                  { label: 'Poor', key: 'poor', color: 'bg-[#c8f135]', emoji: '🟠' },
                  { label: 'Avoid', key: 'avoid', color: 'bg-red-500/100', emoji: '🔴' }
                ].map(item => {
                  const count = dashboard.pantry_stats.breakdown[item.key] || 0;
                  const total = dashboard.pantry_stats.total_items || 1;
                  const pct = (count / total) * 100;
                  return (
                    <div key={item.key} className="flex items-center gap-3">
                      <span className="w-6">{item.emoji}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.label}</span>
                          <span className="text-[#666]">{count}</span>
                        </div>
                        <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${item.color} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly Trend */}
          {dashboard.weekly_trend && (
            <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
              <h2 className="font-semibold text-[#f4f4f0] mb-3">This Week</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[#f4f4f0]">
                    {dashboard.weekly_trend.scans || 0}
                  </div>
                  <div className="text-xs text-[#666]">Scans</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#c8f135]">
                    {dashboard.weekly_trend.swaps || 0}
                  </div>
                  <div className="text-xs text-[#666]">Swaps</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-500">
                    {dashboard.weekly_trend.recipes || 0}
                  </div>
                  <div className="text-xs text-[#666]">Recipes</div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/swaps"
              className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm text-center"
            >
              <span className="text-2xl block mb-2">🔄</span>
              <span className="text-sm font-medium text-[#bbb]">Find Swaps</span>
            </Link>
            <Link
              to="/recipes"
              className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm text-center"
            >
              <span className="text-2xl block mb-2">👨‍🍳</span>
              <span className="text-sm font-medium text-[#bbb]">Browse Recipes</span>
            </Link>
          </div>
        </>
      )}

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div className="space-y-3">
          {achievements.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-xl font-semibold text-[#f4f4f0] mb-2">No achievements yet</h2>
              <p className="text-[#666]">Start scanning products to earn badges!</p>
            </div>
          ) : (
            achievements.map((achievement, index) => (
              <div 
                key={index}
                className={`bg-[#0d0d0d] rounded-sm p-4 shadow-sm flex items-center gap-4 ${
                  !achievement.earned ? 'opacity-50' : ''
                }`}
              >
                {/* Badge */}
                <div className={`w-14 h-14 rounded-sm flex items-center justify-center text-2xl ${
                  achievement.earned 
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
                    : 'bg-[#2a2a2a]'
                }`}>
                  {achievement.icon}
                </div>
                
                {/* Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-[#f4f4f0]">{achievement.name}</h3>
                  <p className="text-sm text-[#666]">{achievement.description}</p>
                  {!achievement.earned && achievement.progress !== undefined && (
                    <div className="mt-2">
                      <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[rgba(200,241,53,0.06)]"
                          style={{ width: `${Math.min(100, achievement.progress)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#888] mt-1">
                        {achievement.current} / {achievement.target}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status */}
                {achievement.earned && (
                  <span className="text-[#c8f135] text-sm font-medium">✓ Earned</span>
                )}
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
