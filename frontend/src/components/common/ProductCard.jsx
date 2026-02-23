import { useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { ScoreBadgeMini } from './ScoreBadge';
import { getScoreLightBgClass, getScoreTextClass, truncate } from '../../utils/helpers';

export default function ProductCard({ product, onClick, showSwapArrow = false, compact = false }) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) {
      onClick(product);
    } else {
      navigate(`/product/${product.upc}`);
    }
  };

  const bgClass = getScoreLightBgClass(product.total_score);
  const harmfulCount = product.harmful_ingredients_found?.length || 0;

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className="w-full card card-pressed p-3 flex items-center gap-3"
      >
        <ScoreBadgeMini score={product.total_score} />
        <div className="flex-1 text-left">
          <p className="font-medium text-[#f4f4f0]">{truncate(product.name, 30)}</p>
          <p className="text-sm text-[#666]">{product.brand}</p>
        </div>
        {showSwapArrow && <ChevronRight className="w-5 h-5 text-[#888]" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="w-full card card-pressed p-4 text-left"
    >
      <div className="flex items-start gap-4">
        {/* Score */}
        <div className={`${bgClass} rounded-sm p-3`}>
          <ScoreBadgeMini score={product.total_score} />
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#f4f4f0] line-clamp-1">{product.name}</h3>
          <p className="text-sm text-[#666]">{product.brand}</p>
          
          {harmfulCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#c8f135]" />
              <span className="text-xs text-[#c8f135] font-medium">
                {harmfulCount} harmful ingredient{harmfulCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {showSwapArrow && (
          <ChevronRight className="w-5 h-5 text-[#888] flex-shrink-0" />
        )}
      </div>
    </button>
  );
}

// Swap comparison card
export function SwapComparisonCard({ fromProduct, toProduct, onSelect }) {
  const improvement = toProduct.total_score - fromProduct.total_score;
  
  return (
    <button
      onClick={() => onSelect(toProduct)}
      className="w-full card card-pressed p-4"
    >
      <div className="flex items-center gap-4">
        {/* To product */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <ScoreBadgeMini score={toProduct.total_score} />
            <span className="text-[#c8f135] text-sm font-semibold">
              +{improvement} pts
            </span>
          </div>
          <h3 className="font-semibold text-[#f4f4f0] mt-2 line-clamp-1">{toProduct.name}</h3>
          <p className="text-sm text-[#666]">{toProduct.brand}</p>
        </div>

        <ChevronRight className="w-5 h-5 text-[#888]" />
      </div>
    </button>
  );
}

// Skeleton loader
export function ProductCardSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="skeleton w-12 h-12 rounded-sm" />
        <div className="flex-1">
          <div className="skeleton h-5 w-3/4 mb-2" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}
