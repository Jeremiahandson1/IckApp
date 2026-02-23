import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

export default function Shopping() {
  const [lists, setLists] = useState([]);
  const [runningLow, setRunningLow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListStore, setNewListStore] = useState('');
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [listsRes, velocityRes] = await Promise.all([
        api.get('/shopping/lists'),
        api.get('/velocity/running-low')
      ]);
      setLists(Array.isArray(listsRes) ? listsRes : []);
      setRunningLow(Array.isArray(velocityRes) ? velocityRes : []);
    } catch (err) {
      showToast('Failed to load shopping data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await api.post('/shopping/lists', {
        name: newListName.trim(),
        store: newListStore.trim() || null
      });
      showToast('List created!', 'success');
      setShowCreate(false);
      setNewListName('');
      setNewListStore('');
      navigate(`/shopping/${res.id}`);
    } catch (err) {
      showToast('Failed to create list', 'error');
    }
  };

  const generateSmartList = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/shopping/lists/generate', { days: 7 });
      showToast(`Created smart shopping list`, 'success');
      navigate(`/shopping/${res.id}`);
    } catch (err) {
      showToast('Failed to generate list', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const deleteList = async (listId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Delete this list?')) return;
    
    try {
      await api.delete(`/shopping/lists/${listId}`);
      showToast('List deleted', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to delete list', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#c8f135] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#f4f4f0]">Shopping</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[rgba(200,241,53,0.06)] text-white rounded-sm text-sm font-medium"
        >
          + New List
        </button>
      </div>

      {/* Running Low Alert */}
      {runningLow.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-sm p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-300">Running Low</h3>
              <p className="text-sm text-amber-700 mb-2">
                {runningLow.length} items predicted to run out soon
              </p>
              <div className="flex flex-wrap gap-2">
                {runningLow.slice(0, 3).map(item => (
                  <span key={item.upc} className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full">
                    {item.name}
                  </span>
                ))}
                {runningLow.length > 3 && (
                  <span className="text-xs text-amber-400">+{runningLow.length - 3} more</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={generateSmartList}
            disabled={generating}
            className="mt-3 w-full py-2 bg-amber-500/100 text-white rounded-sm text-sm font-medium disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Smart List'}
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={generateSmartList}
          disabled={generating}
          className="p-4 bg-gradient-to-br from-[#c8f135] to-green-600 text-white rounded-sm text-left disabled:opacity-50"
        >
          <span className="text-2xl block mb-2">🤖</span>
          <span className="font-semibold block">Smart List</span>
          <span className="text-xs opacity-80">Based on velocity</span>
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="p-4 bg-[#0d0d0d] border-2 border-dashed border-[#333] rounded-sm text-left"
        >
          <span className="text-2xl block mb-2">📝</span>
          <span className="font-semibold text-[#bbb] block">Manual List</span>
          <span className="text-xs text-[#666]">Create from scratch</span>
        </button>
      </div>

      {/* Lists */}
      <div className="space-y-3">
        {lists.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-xl font-semibold text-[#f4f4f0] mb-2">No shopping lists</h2>
            <p className="text-[#666] mb-6">
              Create a list or let us generate one based on your consumption patterns
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-semibold text-[#f4f4f0]">Your Lists</h2>
            {lists.map(list => (
              <Link
                key={list.id}
                to={`/shopping/${list.id}`}
                className="block bg-[#0d0d0d] rounded-sm p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[#f4f4f0]">{list.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-[#666]">
                      {list.store && <span>🏪 {list.store}</span>}
                      <span>{list.item_count || 0} items</span>
                      <span>•</span>
                      <span>{formatDate(list.created_at)}</span>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {list.status === 'completed' ? (
                      <span className="px-2 py-1 bg-[rgba(200,241,53,0.1)] text-[#7a8e00] text-xs rounded-full">
                        ✓ Done
                      </span>
                    ) : list.status === 'shopping' ? (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-700 text-xs rounded-full">
                        🛒 Shopping
                      </span>
                    ) : null}
                    
                    {/* Delete */}
                    <button
                      onClick={(e) => deleteList(list.id, e)}
                      className="p-2 text-[#888] hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Progress if shopping */}
                {list.status === 'shopping' && list.item_count > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                    <div className="flex items-center justify-between text-xs text-[#666] mb-1">
                      <span>Progress</span>
                      <span>{list.checked_count || 0} of {list.item_count}</span>
                    </div>
                    <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[rgba(200,241,53,0.06)]"
                        style={{ width: `${((list.checked_count || 0) / list.item_count) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Create List Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d0d0d] rounded-sm p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">New Shopping List</h2>
            
            <form onSubmit={createList}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#bbb] mb-1">
                  List Name
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Weekly Groceries"
                  className="w-full px-4 py-3 border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                  autoFocus
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#bbb] mb-1">
                  Store (optional)
                </label>
                <input
                  type="text"
                  value={newListStore}
                  onChange={(e) => setNewListStore(e.target.value)}
                  placeholder="e.g., Whole Foods"
                  className="w-full px-4 py-3 border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 bg-[#1e1e1e] text-[#888] rounded-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim()}
                  className="flex-1 py-3 bg-[rgba(200,241,53,0.06)] text-white rounded-sm font-medium disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
