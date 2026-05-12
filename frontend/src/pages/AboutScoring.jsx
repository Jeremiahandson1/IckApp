import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';

const DIMENSIONS = [
  { name: 'Harmful Ingredients', weight: '40%', body: 'Penalizes the 53 most-harmful additives — artificial colors flagged in the EU/UK, preservatives banned in Japan, and additives the FDA itself has acknowledged are reasonably anticipated to be carcinogenic.' },
  { name: 'Banned Elsewhere',    weight: '20%', body: 'Counts how many of the product\'s ingredients are banned or restricted in major regulatory regions outside the US (EU, UK, Japan, Canada, Australia).' },
  { name: 'Transparency',        weight: '15%', body: 'Penalizes products with missing or vague ingredient lists ("natural flavors," undisclosed sources). Rewards clear, complete labeling.' },
  { name: 'Processing',          weight: '15%', body: 'Uses the NOVA classification: minimally processed foods score highest; ultra-processed foods (with industrial additives, isolates, and reconstructed ingredients) score lowest.' },
  { name: 'Company Behavior',    weight: '10%', body: 'Tracks the parent company\'s record on consumer-protection lawsuits, ingredient transparency, and historical product-safety issues.' },
];

const CONDITION_SUMMARIES = [
  { slug: 'celiac',   name: 'Celiac / Gluten Intolerance', body: 'Binary safety model: any wheat, barley, rye, or triticale ingredient drops the score to zero. Conventional oats are flagged for cross-contamination risk; certified gluten-free products are rewarded.' },
  { slug: 'heart',    name: 'Heart Disease / Cholesterol', body: 'Trans fat (any amount) is a hard avoid. Saturated fat, sodium, and added sugar use the UK FSA per-100g traffic-light thresholds. Processed meats penalized per IARC. Omega-3 sources, soluble fiber, and whole grains rewarded.' },
  { slug: 'diabetes', name: 'Diabetes / Blood Sugar',      body: 'Added sugar penalized at three tiers (FSA "moderate," "high," "very high"). Carbohydrate-to-fiber ratio used as a glycemic-load proxy. Whole grains and high fiber rewarded.' },
  { slug: 'kidney',   name: 'Kidney Disease',              body: 'Stage-aware. Phosphate additives penalized universally (absorbed at ~90% vs 40–60% for natural phosphorus). Protein and potassium restrictions only kick in for CKD 3-4 or dialysis stages. Oxalate flagged only for the calcium-oxalate stones subtype.' },
  { slug: 'thyroid',  name: 'Thyroid Disease',             body: "Hyperthyroidism: high-iodine seaweeds (kelp, kombu, etc.) and added iodine penalized — both can genuinely worsen thyrotoxicosis. Hypothyroidism and Hashimoto's: no diet-based deductions (per ATA 2014 and AACE 2012, no dietary restriction is recommended in iodine-sufficient regions), only informational flags for ingredients that interfere with levothyroxine absorption." },
];

export default function AboutScoring() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    api.get('/conditions/sources').then(setMeta).catch(() => setMeta({}));
  }, []);

  return (
    <div className="pb-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 mb-6 text-[#888] active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Back</span>
      </button>

      <h1 className="text-2xl font-bold text-[#f4f4f0] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        How Scoring Works
      </h1>
      <p className="text-xs text-[#666] mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
        Methodology, sources, and limitations · Rules v{meta?.rulesVersion || '…'}
      </p>

      {/* Two-layer overview */}
      <section className="bg-[#0d0d0d] rounded-sm p-4 mb-5 border border-[#1e1e1e]">
        <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Two scoring layers</h2>
        <p className="text-sm text-[#bbb] leading-relaxed">
          Every scanned product gets a <strong className="text-[#c8f135]">Normal Score</strong> (0–100) based on five
          dimensions that apply to everyone. If you have a health condition set in your profile, you also see a{' '}
          <strong className="text-[#c8f135]">Condition Score</strong> side-by-side that overlays condition-specific
          guidance from clinical guidelines.
        </p>
      </section>

      {/* 5 dimensions */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-[#f4f4f0] mb-3">Normal Score — 5 Dimensions</h2>
        <div className="space-y-2">
          {DIMENSIONS.map(d => (
            <div key={d.name} className="bg-[#0d0d0d] rounded-sm p-3 border border-[#1e1e1e]">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-medium text-sm text-[#f4f4f0]">{d.name}</h3>
                <span className="text-xs text-[#c8f135] font-mono">{d.weight}</span>
              </div>
              <p className="text-xs text-[#888] leading-relaxed">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Condition scoring */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-[#f4f4f0] mb-3">Condition Scoring</h2>
        <p className="text-sm text-[#888] mb-3 leading-relaxed">
          Each condition has its own scorer with rules grounded in published clinical guidelines. Thresholds use
          per-100g normalization where possible, so a small chip serving and a frozen entree are compared fairly.
        </p>
        <div className="space-y-2">
          {CONDITION_SUMMARIES.map(c => (
            <div key={c.slug} className="bg-[#0d0d0d] rounded-sm p-3 border border-[#1e1e1e]">
              <h3 className="font-medium text-sm text-[#f4f4f0] mb-1">{c.name}</h3>
              <p className="text-xs text-[#888] leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-[#f4f4f0] mb-3">Sources</h2>
        <p className="text-xs text-[#666] mb-3 leading-relaxed">
          Every rule in the condition scorers carries an inline citation tag pointing to one of these references.
        </p>
        {meta?.sources ? (
          <ul className="space-y-2 text-xs text-[#888] leading-relaxed">
            {Object.entries(meta.sources).map(([tag, ref]) => (
              <li key={tag} className="bg-[#0d0d0d] p-3 rounded-sm border border-[#1e1e1e]">
                <span className="text-[#c8f135] font-mono text-[10px] mr-2">{tag}</span>
                {ref}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[#555]">Loading sources…</p>
        )}
      </section>

      {/* Disclaimer */}
      <section className="bg-[#0d0d0d] rounded-sm p-4 border border-amber-900/30 mb-2">
        <h2 className="text-base font-semibold text-amber-300 mb-2">Limitations</h2>
        <p className="text-xs text-[#bbb] leading-relaxed mb-2">
          {meta?.disclaimer || 'Informational only — not medical advice. Consult your clinician or registered dietitian for condition-specific dietary guidance.'}
        </p>
        <p className="text-xs text-[#888] leading-relaxed">
          The condition scorer cannot account for your medications, current labs, total daily intake, individual
          tolerances, or stage-specific clinical context. Scores are heuristics over guideline thresholds, not a
          medical assessment.
        </p>
      </section>
    </div>
  );
}
