import { useEffect, useState } from 'react';

const VERDICTS = {
  excellent: { label: 'Clean',   color: '#22c55e', ring: '#22c55e',  bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)' },
  good:      { label: 'Decent',  color: '#86efac', ring: '#86efac',  bg: 'rgba(134,239,172,0.08)', border: 'rgba(134,239,172,0.2)' },
  fair:      { label: 'Meh',     color: '#fbbf24', ring: '#fbbf24',  bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)' },
  poor:      { label: 'Ick It',  color: '#f97316', ring: '#f97316',  bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)' },
  bad:       { label: 'Avoid',   color: '#ff3b30', ring: '#ff3b30',  bg: 'rgba(255,59,48,0.08)',   border: 'rgba(255,59,48,0.25)' },
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
    const duration = 900;
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      setAnimatedPct(eased * (score / 100));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  const dashOffset = circumference * (1 - animatedPct);

  return (
    <div
      className="flex flex-col items-center py-6 px-4"
      style={{ background: verdict.bg, border: `1px solid ${verdict.border}` }}
    >
      {/* Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={8}
            stroke="rgba(255,255,255,0.06)"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            stroke={verdict.ring}
            style={{ transition: 'stroke-dashoffset 0.1s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: size * 0.3,
            lineHeight: 1,
            color: verdict.color,
          }}>
            {animatedScore}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '2px',
            color: 'var(--muted)',
          }}>/100</span>
        </div>
      </div>

      {/* Verdict pill */}
      <div
        className="mt-3 px-4 py-1"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          letterSpacing: '3px',
          color: verdict.color,
          textTransform: 'uppercase',
        }}
      >
        {verdict.label}
      </div>

      {/* Sentence */}
      <p style={{
        marginTop: '6px',
        fontSize: '13px',
        color: 'var(--muted)',
        textAlign: 'center',
        maxWidth: '240px',
        fontWeight: 300,
      }}>
        {getVerdictSentence(score, name)}
      </p>
    </div>
  );
}

export { getVerdict, getVerdictSentence };
