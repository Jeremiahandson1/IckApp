import { useEffect, useState } from 'react';

// Thresholds and labels match helpers.js getScoreRating() / getScoreLabel()
const VERDICTS = {
  excellent: { label: 'Clean',   emoji: '🟢', color: 'text-green-400',  ring: 'stroke-green-400',  bg: 'bg-green-500/10' },
  good:      { label: 'Decent',  emoji: '🟢', color: 'text-green-500',  ring: 'stroke-green-500',  bg: 'bg-green-500/10' },
  fair:      { label: 'Meh',     emoji: '🟡', color: 'text-amber-400',  ring: 'stroke-amber-400',  bg: 'bg-amber-500/10' },
  poor:      { label: 'Ick',     emoji: '🟠', color: 'text-orange-500', ring: 'stroke-orange-500', bg: 'bg-orange-500/10' },
  bad:       { label: 'Avoid',   emoji: '🔴', color: 'text-red-500',    ring: 'stroke-red-500',    bg: 'bg-red-500/10' },
};

function getVerdict(score) {
  if (score >= 86) return VERDICTS.excellent;
  if (score >= 71) return VERDICTS.good;
  if (score >= 51) return VERDICTS.fair;
  if (score >= 31) return VERDICTS.poor;
  return VERDICTS.bad;
}

function getVerdictSentence(score, name) {
  const short = name?.split(' ').slice(0, 3).join(' ') || 'This product';
  if (score >= 86) return `${short} is a clean choice. No ick here.`;
  if (score >= 71) return `${short} is decent. Could be worse.`;
  if (score >= 51) return `${short} is just okay. We'd keep looking.`;
  if (score >= 31) return `We recommend you ick that ish. Better options exist.`;
  return `Ick that ish. Put it back on the shelf.`;
}

export default function ScoreRing({ score, name, size = 140 }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedPct, setAnimatedPct] = useState(0);

  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const verdict = getVerdict(score);

  useEffect(() => {
    // Animate from 0 to score
    const duration = 800;
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      setAnimatedPct(eased * (score / 100));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  const dashOffset = circumference * (1 - animatedPct);

  return (
    <div className={`flex flex-col items-center py-6 px-4 rounded-2xl ${verdict.bg}`}>
      {/* Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={10}
            className="stroke-gray-200/50"
          />
          {/* Colored progress */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`${verdict.ring} transition-all duration-100`}
          />
        </svg>
        {/* Score number in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${verdict.color}`}>
            {animatedScore}
          </span>
          <span className="text-xs text-gray-400 font-medium">/100</span>
        </div>
      </div>

      {/* Verdict */}
      <div className={`mt-3 px-4 py-1.5 rounded-full font-bold text-sm uppercase tracking-wider ${verdict.color} ${verdict.bg}`}>
        {verdict.label}
      </div>

      {/* One-sentence verdict */}
      <p className="mt-2 text-sm text-gray-400 text-center max-w-xs">
        {getVerdictSentence(score, name)}
      </p>
    </div>
  );
}

export { getVerdict, getVerdictSentence };
