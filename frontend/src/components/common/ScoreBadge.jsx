import { getScoreBgClass, getScoreLabel, getScoreRating } from '../../utils/helpers';

export default function ScoreBadge({ score, size = 'md', showLabel = false, animated = false }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-20 h-20 text-3xl'
  };

  const bgClass = getScoreBgClass(score);
  const rating = getScoreRating(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div 
        className={`
          ${sizeClasses[size]} ${bgClass}
          rounded-full flex items-center justify-center text-white font-bold
          shadow-lg shadow-current/20
          ${animated ? 'animate-pulse-score' : ''}
        `}
      >
        {Math.round(score)}
      </div>
      {showLabel && (
        <span className={`text-xs font-semibold uppercase tracking-wide ${bgClass.replace('bg-', 'text-')}`}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}

// Mini version for lists
export function ScoreBadgeMini({ score }) {
  const bgClass = getScoreBgClass(score);
  
  return (
    <span className={`${bgClass} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
      {Math.round(score)}
    </span>
  );
}

// Horizontal bar version
export function ScoreBar({ score, showValue = true }) {
  const bgClass = getScoreBgClass(score);
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div 
          className={`h-full ${bgClass} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      {showValue && (
        <span className="text-sm font-medium text-[#888] w-8">
          {Math.round(score)}
        </span>
      )}
    </div>
  );
}
