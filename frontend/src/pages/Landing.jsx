import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const S = {
  page:       { background: '#0a0a0a', color: '#f4f4f0', fontFamily: 'var(--font-body)', minHeight: '100vh', overflowX: 'hidden' },
  nav:        { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a' },
  logo:       { fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '3px', color: '#c8f135', textDecoration: 'none' },
  logoSub:    { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', display: 'block', marginTop: '-2px' },
  navRight:   { display: 'flex', alignItems: 'center', gap: '20px' },
  navLink:    { color: '#888', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
  navBtn:     { background: '#c8f135', color: '#0a0a0a', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 700 },
  hero:       { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '100px 24px 48px', position: 'relative', overflow: 'hidden' },
  heroBg:     { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: 'var(--font-display)', fontSize: 'clamp(140px, 40vw, 420px)', color: 'transparent', WebkitTextStroke: '1px rgba(200,241,53,0.04)', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', letterSpacing: '20px' },
  eyebrow:    { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#c8f135', marginBottom: '16px' },
  heroH1:     { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 16vw, 140px)', lineHeight: '0.92', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px' },
  heroAccent: { color: '#c8f135', display: 'block' },
  heroStroke: { color: 'transparent', WebkitTextStroke: '2px #f4f4f0', display: 'block' },
  heroSub:    { fontSize: 'clamp(15px, 2.5vw, 18px)', fontWeight: 300, color: 'rgba(244,244,240,0.65)', maxWidth: '520px', lineHeight: 1.6, marginBottom: '36px' },
  actions:    { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '48px' },
  btnPrimary: { background: '#c8f135', color: '#0a0a0a', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', padding: '14px 28px', border: 'none', cursor: 'pointer', fontWeight: 700 },
  btnSecondary:{ color: '#f4f4f0', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', padding: '14px 20px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: 'transparent' },
  statRow:    { borderTop: '1px solid #2a2a2a', paddingTop: '32px', display: 'flex', gap: '40px', flexWrap: 'wrap' },
  statNum:    { fontFamily: 'var(--font-display)', fontSize: '40px', color: '#c8f135', lineHeight: 1 },
  statLabel:  { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: '#555', marginTop: '4px' },
  marquee:    { borderTop: '1px solid #2a2a2a', borderBottom: '1px solid #2a2a2a', padding: '14px 0', overflow: 'hidden', background: '#111' },
  marqueeTrack: { display: 'flex', width: 'max-content', animation: 'marquee 28s linear infinite' },
  marqueeItem:  { fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: '3px', textTransform: 'uppercase', padding: '0 32px', color: '#444', whiteSpace: 'nowrap' },
  marqueeHot:   { color: '#c8f135' },
  section:    { padding: '80px 24px', maxWidth: '1100px', margin: '0 auto' },
  label:      { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#c8f135', marginBottom: '16px' },
  sectionH2:  { fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 8vw, 72px)', lineHeight: '0.95', textTransform: 'uppercase', marginBottom: '20px' },
  sectionBody:{ color: 'rgba(244,244,240,0.6)', fontSize: '16px', fontWeight: 300, lineHeight: 1.7, maxWidth: '440px' },
  grid3:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '2px', marginTop: '48px' },
  card:       { background: '#161616', border: '1px solid #2a2a2a', padding: '28px 24px', position: 'relative', overflow: 'hidden' },
  cardRedBar: { position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#ff3b30' },
  cardIngredient: { fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' },
  cardFoundIn:{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', color: '#555', marginBottom: '12px' },
  tagRed:     { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 8px', background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.25)', color: '#ff3b30', display: 'inline-block', marginRight: '4px', marginBottom: '4px' },
  tagGreen:   { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 8px', background: 'rgba(200,241,53,0.08)', border: '1px solid rgba(200,241,53,0.2)', color: '#c8f135', display: 'inline-block', marginRight: '4px', marginBottom: '4px' },
  step:       { background: '#161616', border: '1px solid #2a2a2a', padding: '40px 28px', position: 'relative' },
  stepNum:    { fontFamily: 'var(--font-display)', fontSize: '80px', lineHeight: 1, color: 'rgba(200,241,53,0.06)', position: 'absolute', top: '12px', right: '20px' },
  stepIcon:   { fontSize: '32px', marginBottom: '20px' },
  stepTitle:  { fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' },
  stepBody:   { fontSize: '14px', color: 'rgba(244,244,240,0.55)', lineHeight: 1.6, fontWeight: 300 },
  emailWrap:  { padding: '80px 24px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' },
  emailH2:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 10vw, 88px)', lineHeight: '0.95', textTransform: 'uppercase', marginBottom: '20px' },
  emailSub:   { color: 'rgba(244,244,240,0.55)', fontSize: '16px', fontWeight: 300, marginBottom: '36px' },
  footer:     { borderTop: '1px solid #1e1e1e', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  footerLogo: { fontFamily: 'var(--font-display)', fontSize: '20px', color: '#c8f135', letterSpacing: '2px' },
  footerSub:  { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '3px', color: '#444', textTransform: 'uppercase', display: 'block', marginTop: '2px' },
  footerCopy: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#333', letterSpacing: '1px' },
  featureBody: { fontSize: '14px', color: 'rgba(244,244,240,0.55)', lineHeight: 1.6, fontWeight: 300, marginTop: '8px' },

  // Tiered "What You Get" grid
  tierWrap:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2px', marginTop: '48px' },
  tierCard:   { background: '#161616', border: '1px solid #2a2a2a', padding: '36px 28px', display: 'flex', flexDirection: 'column' },
  tierCardFeatured: { background: '#161616', border: '1px solid #c8f135', padding: '36px 28px', display: 'flex', flexDirection: 'column', position: 'relative' },
  tierBadge:  { position: 'absolute', top: '-10px', left: '24px', background: '#c8f135', color: '#0a0a0a', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 10px', fontWeight: 700 },
  tierLabel:  { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: '#666', marginBottom: '8px' },
  tierName:   { fontFamily: 'var(--font-display)', fontSize: '32px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' },
  tierPrice:  { fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#c8f135', marginBottom: '24px' },
  tierFeat:   { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderTop: '1px solid #1f1f1f', fontSize: '13px', color: 'rgba(244,244,240,0.75)', lineHeight: 1.4 },
  tierCheck:  { color: '#c8f135', flexShrink: 0, marginTop: '2px', fontFamily: 'var(--font-mono)', fontSize: '10px' },

  // Comparison table
  compWrap:   { marginTop: '48px', border: '1px solid #2a2a2a', background: '#0d0d0d' },
  compRow:    { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: '1px solid #1f1f1f' },
  compRowHead:{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', background: '#111', borderBottom: '1px solid #2a2a2a' },
  compCell:   { padding: '16px 20px', fontSize: '13px', color: 'rgba(244,244,240,0.8)' },
  compCellHead:{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: '#888' },
  compCellMe: { padding: '16px 20px', fontSize: '13px', color: '#c8f135', textAlign: 'center', borderLeft: '1px solid #1f1f1f', fontWeight: 600 },
  compCellThem:{ padding: '16px 20px', fontSize: '13px', color: 'rgba(244,244,240,0.5)', textAlign: 'center', borderLeft: '1px solid #1f1f1f' },

  // Mobile sticky scan CTA
  stickyMobile: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(10,10,10,0.96)', backdropFilter: 'blur(12px)', borderTop: '1px solid #2a2a2a', padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', display: 'flex', gap: '10px', alignItems: 'center' },
  stickyCopy: { flex: 1, fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', lineHeight: 1.3 },
  stickyBtn:  { background: '#c8f135', color: '#0a0a0a', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', padding: '12px 20px', border: 'none', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },

  // Device frame mockup
  deviceFrame: { background: '#1a1a1a', border: '8px solid #1a1a1a', borderRadius: '32px', padding: '0', boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 1px #333', overflow: 'hidden', aspectRatio: '9/19', maxWidth: '240px', margin: '0 auto' },
  deviceScreen: { background: '#0a0a0a', height: '100%', padding: '20px 14px', display: 'flex', flexDirection: 'column' },
  deviceNotch: { width: '60px', height: '6px', background: '#333', borderRadius: '3px', margin: '0 auto 16px' },
};

const banned = [
  { name: 'Red Dye 40', foundIn: 'Doritos · Froot Loops · M&Ms · Jell-O', bans: ['Banned: EU*', 'Banned: UK*'], ok: ['Allowed: USA'], note: '*Requires "may affect activity in children" warning label' },
  { name: 'Brominated Veg. Oil', foundIn: 'Mountain Dew · Citrus Sports Drinks', bans: ['Banned: EU', 'Banned: Japan', 'Banned: India'], ok: ['Allowed: USA'], note: 'Bromine accumulates in tissue. FDA banned it in 2024 — still in supply chains.' },
  { name: 'Titanium Dioxide', foundIn: 'Skittles · Chewing Gum · Frosting · Ranch', bans: ['Banned: France 2020', 'Banned: EU 2022'], ok: ['Allowed: USA'], note: 'Used purely for whitening. EFSA: can no longer be considered safe.' },
  { name: 'Potassium Bromate', foundIn: 'Bread · Rolls · Bagels · Pizza Dough', bans: ['Banned: EU', 'Banned: UK', 'Banned: Canada'], ok: ['Allowed: USA'], note: 'IARC classifies it as a possible human carcinogen. Banned in 20+ countries.' },
  { name: 'BHA / BHT', foundIn: 'Cereal · Potato Chips · Chewing Gum · Butter', bans: ['Banned: Japan', 'Restricted: EU'], ok: ['Allowed: USA'], note: 'BHA listed as "reasonably anticipated to be a human carcinogen" by US Dept of Health.' },
  { name: 'TBHQ', foundIn: 'Pop-Tarts · Ramen · McDonald\'s Nuggets', bans: ['Banned: Japan', 'Banned: EU'], ok: ['Allowed: USA'], note: 'Derived from petroleum. High doses linked to tumors in animal studies.' },
];

// Tiered feature lists — Free / Free Account / Premium
const tiers = [
  {
    label: 'Free — No Login',
    name: 'Just Scan',
    price: 'No account needed',
    features: [
      'Barcode scanner (845K+ products)',
      '5-Dimension scoring (0–100)',
      'Banned-Elsewhere ingredient map',
      'Health condition scoring (Thyroid, Diabetes, Heart, Kidney, Celiac)',
      'Smart swap recommendations',
      'Allergen alerts (set once, applied every scan)',
      '3,668 swap recipes',
    ],
  },
  {
    label: 'Free Account',
    name: 'Whole House',
    price: 'Free forever',
    featured: true,
    features: [
      'Everything in Just Scan, plus —',
      'Pantry: save scanned products',
      'Receipt scan: bulk-add 40+ items from one photo',
      'Budget tracker for groceries',
      'Progress tracking: watch your household score climb',
      'Family sharing with per-member profiles',
      'Per-member allergens + health conditions',
    ],
  },
  {
    label: 'Premium',
    name: 'Power User',
    price: '$4.99/mo · $39.99/yr',
    features: [
      'Everything in Whole House, plus —',
      'Pantry Health Audit — full audit of every product you own',
      'Smart shopping lists — auto-generated from swaps + pantry',
      'In-store Shopping Mode — item-by-item walkthrough',
    ],
  },
];

const comparison = [
  ['Banned-elsewhere ingredient scoring', true, false],
  ['Health-condition dual scoring (clinical guidelines)', true, false],
  ['Parent-company behavior scoring', true, false],
  ['Pantry — save scanned products', true, false],
  ['Receipt scan to bulk-add pantry', true, false],
  ['Grocery budget tracker', true, false],
  ['Household score progress over time', true, false],
  ['Family sharing — per-member profiles', true, false],
  ['Smart shopping lists', true, false],
  ['3,000+ swap-based recipes', true, false],
  ['Paid brand certifications', 'Never', 'EWG, WISEcode'],
  ['In-app advertising', 'Never', 'Fooducate'],
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, []);
  return isMobile;
}

export default function Landing() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Scroll to hash on mount (handles deep-links like /#compare and the
  // /compare route that redirects here, plus /#features etc.)
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const tryScroll = () => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      // Defer past first paint so the target section exists in the DOM
      setTimeout(tryScroll, 100);
    }
  }, []);

  const marqueeItems = [
    ['Red 40', true], ['Banned in EU', false], ['BHA / BHT', true], ["In Your Kids' Cereal", false],
    ['Titanium Dioxide', true], ['Banned in France 2020', false], ['TBHQ', true], ['Banned in Japan', false],
    ['Brominated Veg. Oil', true], ['Still in Your Sports Drink', false], ['Potassium Bromate', true], ['Banned in 20+ Countries', false],
  ];

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ ...S.page, paddingBottom: isMobile ? '80px' : 0 }}>
      {/* NAV */}
      <nav style={S.nav}>
        <div>
          <span style={S.logo}>ICKTHATISH</span>
          <span style={S.logoSub}>by Twomiah</span>
        </div>
        <div style={S.navRight}>
          {!isMobile && (
            <>
              <button style={S.navLink} onClick={() => scrollTo('features')}>Features</button>
              <button style={S.navLink} onClick={() => scrollTo('compare')}>Compare</button>
            </>
          )}
          <button style={S.navBtn} onClick={() => navigate('/scan')}>{isMobile ? 'Scan →' : 'Start Scanning →'}</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={S.hero}>
        <div style={S.heroBg}>ICK</div>
        <p style={S.eyebrow}>The Only Food App That Cleans Out Your Whole House</p>
        <h1 style={S.heroH1}>
          <span>Your</span>
          <span style={S.heroAccent}>Grocery</span>
          <span style={S.heroStroke}>Store</span>
          <span>Lied.</span>
        </h1>
        <p style={S.heroSub}>
          Scan any product. See every ingredient <strong style={{ color: '#f4f4f0' }}>banned in Europe</strong> that's still in your food.
          Then replace it, track your progress, and clean out your whole house.
        </p>
        <div style={S.actions}>
          <button style={S.btnPrimary} onClick={() => navigate('/scan')}>
            {isMobile ? 'Scan Now — No Install →' : 'Scan a Product →'}
          </button>
          <button style={S.btnSecondary} onClick={() => navigate('/register')}>Create Free Account</button>
        </div>
        <div style={S.statRow}>
          {[['845K+','Products in Database'],['53','Flagged Ingredients'],['3,668','Swap Recipes'],['0','Brand Deals. Ever.']].map(([n,l]) => (
            <div key={l}><div style={S.statNum}>{n}</div><div style={S.statLabel}>{l}</div></div>
          ))}
        </div>
      </section>

      {/* MARQUEE */}
      <div style={S.marquee}>
        <div style={S.marqueeTrack}>
          {[...marqueeItems, ...marqueeItems].map(([text, hot], i) => (
            <span key={i} style={{ ...S.marqueeItem, ...(hot ? S.marqueeHot : {}) }}>{text}</span>
          ))}
        </div>
      </div>

      {/* BANNED SECTION */}
      <section style={{ ...S.section, background: '#0d0d0d', maxWidth: '100%', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', marginBottom: '48px', alignItems: 'end' }}>
            <div>
              <p style={S.label}>The Truth</p>
              <h2 style={{ ...S.sectionH2, marginBottom: '0' }}>Banned<br/>Everywhere<br/><span style={{ color: '#c8f135' }}>Except Here.</span></h2>
            </div>
            <p style={S.sectionBody}>The EU, UK, Japan, Australia — they banned these ingredients years ago. The US food industry kept using them because nobody forced them to stop. Until now, most people had no idea.</p>
          </div>
          <div style={S.grid3}>
            {banned.map((b) => (
              <div key={b.name} style={S.card}>
                <div style={S.cardRedBar} />
                <div style={S.cardIngredient}>{b.name}</div>
                <div style={S.cardFoundIn}>{b.foundIn}</div>
                <div>
                  {b.bans.map(t => <span key={t} style={S.tagRed}>{t}</span>)}
                  {b.ok.map(t => <span key={t} style={S.tagGreen}>{t}</span>)}
                </div>
                <p style={{ fontSize: '10px', color: '#444', marginTop: '10px', lineHeight: 1.5 }}>{b.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 5 STEPS */}
      <section style={S.section}>
        <p style={S.label}>How It Works</p>
        <h2 style={S.sectionH2}>One Scan.<br/><span style={{ color: '#c8f135' }}>A Full Loop.</span></h2>
        <p style={{ ...S.sectionBody, marginTop: '16px' }}>Most apps stop at the scan result. We start there.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2px', marginTop: '48px' }}>
          {[
            { n:'1', icon:'📷', title:'Scan',       body:'Point your camera at any product. Pulled live from Open Food Facts (845K+) plus our curated database.' },
            { n:'2', icon:'🔬', title:'See Truth',  body:'Every flagged ingredient explained — what it does, who banned it, and why the FDA still allows it here.' },
            { n:'3', icon:'✅', title:'Get a Swap', body:'A cleaner alternative with a better score. Never a paid placement — just the actual best option.' },
            { n:'4', icon:'🛒', title:'Save It',   body:'Snap your receipt — Ick auto-adds your whole grocery haul to your pantry in seconds.' },
            { n:'5', icon:'📈', title:'Track Progress', body:'Watch your household score climb every time you swap. Family members each get their own profile.' },
          ].map(s => (
            <div key={s.n} style={S.step}>
              <div style={S.stepNum}>{s.n}</div>
              <div style={S.stepIcon}>{s.icon}</div>
              <div style={S.stepTitle}>{s.title}</div>
              <div style={S.stepBody}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TIERED FEATURES — Free / Account / Premium */}
      <section id="features" style={{ ...S.section, background: '#0d0d0d', maxWidth: '100%', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={S.label}>What You Get</p>
          <h2 style={{ ...S.sectionH2, marginBottom: '20px' }}>Generous Free Tier.<br/><span style={{ color: '#c8f135' }}>Honest Premium.</span></h2>
          <p style={{ ...S.sectionBody, marginBottom: '12px' }}>You can use the entire scanning engine without ever creating an account. An account unlocks your pantry, receipt scan, budget, progress tracking, and family sharing — all free. Premium adds the deep-cleaning tools.</p>
          <div style={S.tierWrap}>
            {tiers.map((t) => (
              <div key={t.name} style={t.featured ? S.tierCardFeatured : S.tierCard}>
                {t.featured && <span style={S.tierBadge}>Most Popular</span>}
                <div style={S.tierLabel}>{t.label}</div>
                <div style={S.tierName}>{t.name}</div>
                <div style={S.tierPrice}>{t.price}</div>
                <div>
                  {t.features.map((f) => (
                    <div key={f} style={S.tierFeat}>
                      <span style={S.tierCheck}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <button style={S.btnSecondary} onClick={() => navigate('/features')}>See every feature in detail →</button>
          </div>
        </div>
      </section>

      {/* ONE SCAN — WHOLE HOUSE */}
      <section style={S.section}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '60px', alignItems: 'center' }}>
          <div>
            <p style={S.label}>The Real Differentiator</p>
            <h2 style={S.sectionH2}>One Scan.<br/>Your <span style={{ color: '#c8f135' }}>Whole House.</span></h2>
            <p style={{ ...S.sectionBody, marginTop: '20px', maxWidth: 'none' }}>
              Scan a product in the store. Scan your receipt at home to add 40 items at once. Your pantry gets a full health audit. Your family each has their own allergen and condition profile. Your household score goes up every time you make a swap.
            </p>
            <p style={{ ...S.sectionBody, marginTop: '20px', maxWidth: 'none', color: '#f4f4f0' }}>
              That's not a scanner. That's a system.
            </p>
            <div style={{ ...S.actions, marginTop: '36px' }}>
              <button style={S.btnPrimary} onClick={() => navigate('/register')}>Start Free →</button>
            </div>
          </div>

          {/* Device-frame mockups */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', alignItems: 'center' }}>
            {/* Scanner mockup */}
            <div style={S.deviceFrame}>
              <div style={S.deviceScreen}>
                <div style={S.deviceNotch} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#666', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Scan Result</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: '#f4f4f0', letterSpacing: '0.5px', lineHeight: 1.1, marginBottom: '12px' }}>Cheez-It<br/>Original</div>
                <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', padding: '12px 10px', textAlign: 'center', marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: '#ff3b30', lineHeight: 1 }}>38</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#ff3b30', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4px' }}>Avoid</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#ff3b30', padding: '4px 6px', background: 'rgba(255,59,48,0.08)', marginBottom: '4px', letterSpacing: '0.5px' }}>⚠ TBHQ — banned in EU</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#ff3b30', padding: '4px 6px', background: 'rgba(255,59,48,0.08)', letterSpacing: '0.5px' }}>⚠ BHT — banned in Japan</div>
              </div>
            </div>

            {/* Pantry mockup */}
            <div style={S.deviceFrame}>
              <div style={S.deviceScreen}>
                <div style={S.deviceNotch} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#666', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>My Pantry</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: '#f4f4f0', letterSpacing: '0.5px', lineHeight: 1.1, marginBottom: '14px' }}>47 Items</div>
                {[
                  ['Triscuit', 78, '#c8f135'],
                  ['Oatly Milk', 92, '#c8f135'],
                  ['Skippy PB', 51, '#f5a623'],
                  ['Doritos', 24, '#ff3b30'],
                  ['Chobani', 81, '#c8f135'],
                ].map(([n, score, color]) => (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a1a1a' }}>
                    <span style={{ fontSize: '9px', color: '#aaa' }}>{n}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color }}>{score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress mockup */}
            <div style={S.deviceFrame}>
              <div style={S.deviceScreen}>
                <div style={S.deviceNotch} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#666', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Household Score</div>
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', color: '#c8f135', lineHeight: 1 }}>67</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#888', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '6px' }}>↑ 26 in 90 Days</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#666', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Recent Swaps</div>
                <div style={{ fontSize: '9px', color: '#aaa', padding: '4px 0' }}>Doritos → Siete chips</div>
                <div style={{ fontSize: '9px', color: '#aaa', padding: '4px 0' }}>Coca-Cola → Olipop</div>
                <div style={{ fontSize: '9px', color: '#aaa', padding: '4px 0' }}>Wonder Bread → Dave's</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section id="compare" style={{ ...S.section, background: '#0d0d0d', maxWidth: '100%', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <p style={S.label}>Vs. The Field</p>
          <h2 style={{ ...S.sectionH2, marginBottom: '20px' }}>The Honest<br/><span style={{ color: '#c8f135' }}>Comparison.</span></h2>
          <p style={{ ...S.sectionBody, marginBottom: '12px' }}>
            We're not the only independent food app — Yuka and Open Food Facts are also brand-money-free, and we respect that. We're the only one that goes past the scanner into pantry, receipts, family, and household progress.
          </p>

          <div style={S.compWrap}>
            <div style={S.compRowHead}>
              <div style={S.compCellHead}>Feature</div>
              <div style={{ ...S.compCellHead, textAlign: 'center', color: '#c8f135', borderLeft: '1px solid #2a2a2a' }}>IckThatIsh</div>
              <div style={{ ...S.compCellHead, textAlign: 'center', borderLeft: '1px solid #2a2a2a' }}>Other Food Apps</div>
            </div>
            {comparison.map(([feat, mine, theirs]) => (
              <div key={feat} style={S.compRow}>
                <div style={S.compCell}>{feat}</div>
                <div style={S.compCellMe}>
                  {mine === true ? '✓' : mine}
                </div>
                <div style={S.compCellThem}>
                  {theirs === false ? '—' : theirs}
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#555', marginTop: '20px', lineHeight: 1.6, maxWidth: '720px' }}>
            Paid certification claims based on publicly documented programs: <strong>EWG Verified</strong> (application + annual fees per product) and <strong>WISEcode Non-UPF Shield™</strong> ($200/SKU/year). <strong>Fooducate</strong> serves in-app advertising via Amazon's ad network. <strong>Yuka</strong> and <strong>Open Food Facts</strong> are subscription/donation-funded and accept no brand money — we share that stance.
          </p>
        </div>
      </section>

      {/* CLINICAL CREDIBILITY BAR */}
      <section style={{ padding: '40px 24px', borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a', background: '#0a0a0a' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: '#888', marginBottom: '14px' }}>Grounded in Published Clinical Guidelines</p>
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
            {['AHA','ADA','KDOQI','ATA','FDA'].map(org => (
              <span key={org} style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '2px', color: '#c8f135' }}>{org}</span>
            ))}
          </div>
          <p style={{ fontSize: '13px', color: 'rgba(244,244,240,0.55)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
            Every condition-specific score cites the guideline it's based on — American Heart Association, American Diabetes Association, KDOQI (kidney), American Thyroid Association, and FDA. No black boxes.
          </p>
          <button
            onClick={() => navigate('/about-scoring')}
            style={{ marginTop: '20px', background: 'transparent', border: '1px solid rgba(200,241,53,0.3)', color: '#c8f135', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', padding: '12px 24px', cursor: 'pointer' }}
          >
            Read the full methodology →
          </button>
        </div>
      </section>

      {/* CTA */}
      <section style={S.emailWrap} id="notify">
        <p style={{ ...S.label, display: 'inline-block', marginBottom: '16px' }}>Free to Use</p>
        <h2 style={S.emailH2}>Stop<br/>Eating<br/><span style={{ color: '#c8f135' }}>The Ick.</span></h2>
        <p style={S.emailSub}>
          No account required to scan. Create a free account to unlock your pantry, track your household's progress, and invite your family.
        </p>
        <div style={{ ...S.actions, justifyContent: 'center' }}>
          <button style={S.btnPrimary} onClick={() => navigate('/scan')}>Scan Now — It's Free →</button>
          <button style={S.btnSecondary} onClick={() => navigate('/register')}>Create Account</button>
        </div>

        {/* App store badges (apps in submission — links go live on approval) */}
        <div style={{ marginTop: '40px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: '#161616', border: '1px solid #2a2a2a', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}></span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#666', letterSpacing: '1px', textTransform: 'uppercase' }}>Coming Soon</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#f4f4f0', letterSpacing: '1px' }}>App Store</div>
            </div>
          </div>
          <div style={{ background: '#161616', border: '1px solid #2a2a2a', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>▶</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#666', letterSpacing: '1px', textTransform: 'uppercase' }}>Coming Soon</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#f4f4f0', letterSpacing: '1px' }}>Google Play</div>
            </div>
          </div>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#444', marginTop: '20px', letterSpacing: '1px' }}>
          Web app works in any mobile browser today. Native apps in review.
        </p>
      </section>

      {/* FOOTER */}
      <footer style={S.footer}>
        <div>
          <div style={S.footerLogo}>ICKTHATISH</div>
          <span style={S.footerSub}>A Twomiah Product · Eau Claire, WI</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <button onClick={() => navigate('/privacy-policy')} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#444', cursor: 'pointer', textDecoration: 'none', background: 'none', border: 'none', padding: 0 }}>Privacy</button>
          <button onClick={() => navigate('/terms')} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#444', cursor: 'pointer', textDecoration: 'none', background: 'none', border: 'none', padding: 0 }}>Terms</button>
          <a href="mailto:hello@ickthatish.com" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#444', cursor: 'pointer', textDecoration: 'none' }}>Contact</a>
        </div>
        <span style={S.footerCopy}>© 2026 Twomiah LLC</span>
      </footer>

      {/* Medical / data disclaimer */}
      <div style={{ padding: '24px', borderTop: '1px solid #1e1e1e', background: '#080808' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', lineHeight: 1.7, color: '#555', maxWidth: '780px', margin: '0 auto', textAlign: 'center' }}>
          IckThatIsh is an informational tool — not medical advice. Condition-specific scoring is grounded in published clinical guidelines (AHA, ADA, KDOQI, ATA, FDA) but does not account for your medications, labs, or individual clinical context. Consult your physician or registered dietitian before making dietary changes based on a health condition. Product data is sourced from Open Food Facts, USDA FoodData Central, and user contributions.
        </p>
      </div>

      {/* MOBILE STICKY SCAN CTA — only shows on phones */}
      {isMobile && (
        <div style={S.stickyMobile}>
          <div style={S.stickyCopy}>No install. No login.<br/>Scans in your browser.</div>
          <button style={S.stickyBtn} onClick={() => navigate('/scan')}>Try It Now →</button>
        </div>
      )}
    </div>
  );
}
