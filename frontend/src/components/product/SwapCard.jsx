// One better-alternative card with score improvement, nearby stores, and
// online purchase links.

export default function SwapCard({ swap, currentScore, onClick }) {
  // No score on the product being compared against → no honest delta to show.
  const improvement = (swap.total_score != null && currentScore != null)
    ? swap.total_score - currentScore
    : null;
  const stores = swap.nearby_stores || [];
  const links = swap.online_links || [];

  return (
    <div className="p-4 bg-[rgba(200,241,53,0.06)] rounded-sm">
      <button onClick={onClick} className="w-full text-left card-pressed">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[#f4f4f0] truncate">{swap.name}</h4>
            <p className="text-sm text-[#888]">{swap.brand}</p>
          </div>
          <div className="text-right ml-3">
            <span className="text-2xl font-bold text-[#c8f135]">
              {swap.total_score == null ? '?' : Math.round(swap.total_score)}
            </span>
            {improvement != null && (
              <p className="text-xs text-[#c8f135] font-medium">+{Math.round(improvement)} pts</p>
            )}
          </div>
        </div>
      </button>

      {/* Where to Buy — stores */}
      {stores.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#333]/50">
          <p className="text-xs font-medium text-[#888] mb-1.5">Available at</p>
          <div className="flex flex-wrap gap-1.5">
            {stores.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-[#2a2a2a]/60 text-[#ccc] rounded-full">
                {s.store_name}{s.price ? ` · $${Number(s.price).toFixed(2)}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Online purchase links */}
      {links.length > 0 && (
        <div className={`${stores.length > 0 ? 'mt-2' : 'mt-3 pt-3 border-t border-[#333]/50'}`}>
          {stores.length === 0 && <p className="text-xs font-medium text-[#888] mb-1.5">Buy online</p>}
          <div className="flex flex-wrap gap-1.5">
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs px-2 py-0.5 bg-[rgba(200,241,53,0.1)] text-[#c8f135] rounded-full hover:bg-[rgba(200,241,53,0.15)] transition-colors"
              >
                {link.name} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
