import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const S = {
  page:       { background: '#0a0a0a', color: '#f4f4f0', fontFamily: 'var(--font-body)', minHeight: '100vh', overflowX: 'hidden' },
  nav:        { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a' },
  logo:       { fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '3px', color: '#c8f135', textDecoration: 'none', cursor: 'pointer' },
  logoSub:    { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', display: 'block', marginTop: '-2px' },
  navRight:   { display: 'flex', alignItems: 'center', gap: '20px' },
  navLink:    { color: '#888', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
  navBtn:     { background: '#c8f135', color: '#0a0a0a', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 700 },
  hero:       { padding: '160px 24px 60px', maxWidth: '1100px', margin: '0 auto' },
  eyebrow:    { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#c8f135', marginBottom: '16px' },
  h1:         { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 10vw, 96px)', lineHeight: '0.95', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px' },
  sub:        { fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 300, color: 'rgba(244,244,240,0.65)', maxWidth: '640px', lineHeight: 1.6, marginBottom: '20px' },
  section:    { padding: '60px 24px', maxWidth: '1100px', margin: '0 auto' },
  catLabel:   { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#c8f135', marginBottom: '12px' },
  catTitle:   { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 6vw, 56px)', lineHeight: '0.95', textTransform: 'uppercase', marginBottom: '12px' },
  catBody:    { color: 'rgba(244,244,240,0.55)', fontSize: '15px', fontWeight: 300, lineHeight: 1.7, maxWidth: '640px', marginBottom: '36px' },
  featGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2px' },
  featCard:   { background: '#161616', border: '1px solid #2a2a2a', padding: '28px 24px' },
  featHead:   { display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '12px' },
  featIcon:   { fontSize: '28px', flexShrink: 0 },
  featName:   { fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.15 },
  featTier:   { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: '#666', marginTop: '4px' },
  featTierPaid: { color: '#c8f135' },
  featBody:   { fontSize: '14px', color: 'rgba(244,244,240,0.6)', lineHeight: 1.6, fontWeight: 300 },
  divider:    { borderTop: '1px solid #1f1f1f', maxWidth: '1100px', margin: '0 auto' },
  ctaWrap:    { padding: '80px 24px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' },
  ctaH2:      { fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 8vw, 72px)', lineHeight: '0.95', textTransform: 'uppercase', marginBottom: '20px' },
  ctaSub:     { color: 'rgba(244,244,240,0.55)', fontSize: '16px', fontWeight: 300, marginBottom: '36px' },
  actions:    { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' },
  btnPrimary: { background: '#c8f135', color: '#0a0a0a', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', padding: '14px 28px', border: 'none', cursor: 'pointer', fontWeight: 700 },
  btnSecondary:{ color: '#f4f4f0', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', padding: '14px 20px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: 'transparent' },
  footer:     { borderTop: '1px solid #1e1e1e', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  footerLogo: { fontFamily: 'var(--font-display)', fontSize: '20px', color: '#c8f135', letterSpacing: '2px' },
  footerSub:  { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '3px', color: '#444', textTransform: 'uppercase', display: 'block', marginTop: '2px' },
  footerCopy: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#333', letterSpacing: '1px' },

  // Mobile sticky
  stickyMobile: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'rgba(10,10,10,0.96)', backdropFilter: 'blur(12px)', borderTop: '1px solid #2a2a2a', padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', display: 'flex', gap: '10px', alignItems: 'center' },
  stickyCopy: { flex: 1, fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', lineHeight: 1.3 },
  stickyBtn:  { background: '#c8f135', color: '#0a0a0a', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', padding: '12px 20px', border: 'none', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
};

const categories = [
  {
    label: 'Category 1',
    title: 'Scanning & Analysis',
    body: 'The scanner core. This is where most food apps stop. We use it as the entry point.',
    features: [
      { icon: '📷', name: 'Instant Barcode Scanner', tier: 'Free — no login', body: 'Point your camera at any product and get a full breakdown in seconds. Pulled live from Open Food Facts (845K+ products) and our curated USDA-backed database. Works for everything from Trader Joe\'s to Target to your local co-op.' },
      { icon: '🧪', name: '5-Dimension Scoring', tier: 'Free — no login', body: 'Every product gets a 0–100 score weighted across Harmful Ingredients (40%), Banned Elsewhere (20%), Transparency (15%), Processing Level (15%), and Company Behavior (10%). More granular than Yuka\'s 3-factor model, more honest than EWG\'s single safety score.' },
      { icon: '🌍', name: 'Banned-Elsewhere Mapping', tier: 'Free — no login', body: 'A dedicated scoring dimension — not just a flag. Every ingredient is checked against EU, UK, Japan, Canada, and Australia regulations. Products full of additives banned in the EU literally cost points in their score.' },
      { icon: '🩺', name: 'Health-Condition Dual Scoring', tier: 'Free — no login', body: 'See a normal score and a condition-specific score side by side. Rules grounded in published clinical guidelines from AHA, ADA, KDOQI, ATA, and FDA. Supports Thyroid (hypo/hyper/Hashimoto\'s), Diabetes, Heart, Kidney (general/CKD 3–4/dialysis/stones), and Celiac.' },
      { icon: '🏢', name: 'Parent-Company Tracking', tier: 'Free — no login', body: '698 brand aliases mapped to 96 parent companies. The Company Behavior dimension reflects who actually owns the brand. Buying a "healthy" label owned by a bad actor costs you points. No other scanner does this.' },
      { icon: '⚠️', name: 'Allergen Alerts', tier: 'Free — no login', body: 'Set your allergens once — gluten, dairy, nuts, soy, eggs, shellfish, sesame — and every scan is automatically flagged. With a family account, each member gets their own allergen profile.' },
      { icon: '🔄', name: 'Smart Swap Recommendations', tier: 'Free — no login', body: 'Scanned something sketchy? We suggest a cleaner alternative with a better score. Not a paid placement — never a paid placement — just the actual best option, with links to find it at major retailers.' },
    ],
  },
  {
    label: 'Category 2',
    title: 'Household Food Management',
    body: 'The category no food scanner has entered. Once you create a free account, the product stops being a scanner and starts being a system.',
    features: [
      { icon: '📦', name: 'Pantry', tier: 'Free account', body: 'Save every scanned product to your personal pantry. See your whole inventory in one place, with scores, expiration tracking, and quick re-scoring when you update your health conditions.' },
      { icon: '🧾', name: 'Receipt Scan', tier: 'Free account', body: 'Snap a photo of your grocery receipt. Ick parses the whole list, looks up each product, scores them, and adds them to your pantry — 40 items in seconds. No other scanner does this.' },
      { icon: '💵', name: 'Budget Tracker', tier: 'Free account', body: 'Track grocery spending by store, by category, by month. The only food app that connects health scores to dollars — see if your "healthy" choices are actually breaking your budget.' },
      { icon: '📈', name: 'Household Progress Tracking', tier: 'Free account', body: 'Watch your household score climb every time you swap a product. "Your pantry was 41 in February. It\'s 67 today. You\'ve removed 23 banned-elsewhere ingredients." This is the retention engine.' },
      { icon: '👨‍👩‍👧‍👦', name: 'Family Sharing', tier: 'Free account', body: 'Invite household members. Shared pantry, shared shopping lists, but each person has their own allergen and health-condition profile. One scan, multiple verdicts — "Mom: 78, Dad: 78, kid with peanut allergy: ⚠ AVOID."' },
      { icon: '🔍', name: 'Pantry Health Audit', tier: 'Premium', tierPaid: true, body: 'A full audit of every product you currently own. Identifies your worst offenders, your highest-impact swaps, and the cumulative banned-elsewhere ingredients in your house. The deep-clean version of pantry tracking.' },
      { icon: '🛒', name: 'Smart Shopping Lists', tier: 'Premium', tierPaid: true, body: 'Auto-generated from your pantry + swap recommendations + family preferences. Knows what you\'re out of, what you should replace, and what to grab instead. Built around your actual eating patterns.' },
      { icon: '🚶', name: 'In-Store Shopping Mode', tier: 'Premium', tierPaid: true, body: 'A guided walkthrough mode for the grocery store. Item-by-item, swap-by-swap. Bridges the gap between learning about bad ingredients on the couch and actually picking the right product in aisle 7.' },
    ],
  },
  {
    label: 'Category 3',
    title: 'Content & Recipes',
    body: '3,668 recipes explicitly tagged as direct replacements for processed products. Not a recipe blog — a replacement engine.',
    features: [
      { icon: '🍳', name: 'Swap-Based Recipe Library', tier: 'Free — no login', body: '3,668 recipes, each tagged with what processed product it replaces. Searching "Pop-Tarts" doesn\'t give you a Pop-Tart recipe — it gives you the homemade alternative that\'s actually worth making.' },
      { icon: '🥫', name: 'From-Pantry Mode', tier: 'Free account', body: 'See only the recipes you can make tonight from what\'s already in your pantry. No "go buy 14 ingredients" recipes when you just want to eat.' },
    ],
  },
  {
    label: 'Category 4',
    title: 'Platform & Trust',
    body: 'The product is web-first but ships on every platform — and we\'ve set up the business so nobody can buy a better score.',
    features: [
      { icon: '🌐', name: 'Web App', tier: 'Works everywhere', body: 'Full app in any browser, mobile or desktop. The camera scanner works in mobile Safari and Chrome. No install required to use the entire free tier.' },
      { icon: '📱', name: 'Native iOS + Android', tier: 'In submission', body: 'Native apps built with Capacitor — full barcode scanner, push notifications, deep links (ick://product/:upc), offline scanning for products you\'ve seen before. Available on App Store and Google Play after store review.' },
      { icon: '🚫', name: 'Zero Brand Money', tier: 'Forever', body: 'No paid certifications. No in-app advertising. No affiliate kickbacks. No "improve your score for a fee" requests. We only take money from users (Premium) — same model Yuka uses, opposite of EWG\'s pay-to-certify program.' },
      { icon: '🔓', name: 'Free Tier Is Genuinely Free', tier: 'Forever', body: 'The entire scanning engine — scanner, scoring, swaps, condition scoring, allergen alerts, recipes — works without an account. An account adds pantry features. Premium adds the deep-clean tools. No dark patterns.' },
    ],
  },
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

export default function Features() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div style={{ ...S.page, paddingBottom: isMobile ? '80px' : 0 }}>
      {/* NAV */}
      <nav style={S.nav}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span style={S.logo}>ICKTHATISH</span>
          <span style={S.logoSub}>by Twomiah</span>
        </div>
        <div style={S.navRight}>
          {!isMobile && (
            <button style={S.navLink} onClick={() => navigate('/')}>Home</button>
          )}
          <button style={S.navBtn} onClick={() => navigate('/scan')}>{isMobile ? 'Scan →' : 'Start Scanning →'}</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={S.hero}>
        <p style={S.eyebrow}>Every Feature, Explained</p>
        <h1 style={S.h1}>What's<br/><span style={{ color: '#c8f135' }}>Actually</span><br/>In Here.</h1>
        <p style={S.sub}>
          IckThatIsh isn't a barcode scanner with extras — it's a household food system that happens to include a scanner. Here's everything we ship, broken down by what it does and what tier unlocks it.
        </p>
        <p style={S.sub}>
          The free tier is generous on purpose. You can use the scanning engine, the condition scoring, the allergen alerts, and the swap recommendations without ever creating an account.
        </p>
      </section>

      {categories.map((cat, idx) => (
        <div key={cat.title}>
          {idx > 0 && <div style={S.divider} />}
          <section style={{ ...S.section, padding: '60px 24px' }}>
            <p style={S.catLabel}>{cat.label}</p>
            <h2 style={S.catTitle}>{cat.title}</h2>
            <p style={S.catBody}>{cat.body}</p>
            <div style={S.featGrid}>
              {cat.features.map((f) => (
                <div key={f.name} style={S.featCard}>
                  <div style={S.featHead}>
                    <div style={S.featIcon}>{f.icon}</div>
                    <div>
                      <div style={S.featName}>{f.name}</div>
                      <div style={{ ...S.featTier, ...(f.tierPaid ? S.featTierPaid : {}) }}>{f.tier}</div>
                    </div>
                  </div>
                  <p style={S.featBody}>{f.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ))}

      {/* CTA */}
      <section style={S.ctaWrap}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#c8f135', marginBottom: '16px' }}>Ready When You Are</p>
        <h2 style={S.ctaH2}>Start<br/><span style={{ color: '#c8f135' }}>Free.</span></h2>
        <p style={S.ctaSub}>
          No account needed to scan. A free account unlocks pantry, receipts, budget, progress, and family sharing.
        </p>
        <div style={S.actions}>
          <button style={S.btnPrimary} onClick={() => navigate('/scan')}>Scan a Product →</button>
          <button style={S.btnSecondary} onClick={() => navigate('/register')}>Create Free Account</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={S.footer}>
        <div>
          <div style={S.footerLogo}>ICKTHATISH</div>
          <span style={S.footerSub}>A Twomiah Product · Eau Claire, WI</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a href="mailto:hello@ickthatish.com?subject=Privacy%20Policy%20Request" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#444', textDecoration: 'none' }}>Privacy</a>
          <a href="mailto:hello@ickthatish.com?subject=Terms%20of%20Service%20Request" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#444', textDecoration: 'none' }}>Terms</a>
          <a href="mailto:hello@ickthatish.com" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#444', textDecoration: 'none' }}>Contact</a>
        </div>
        <span style={S.footerCopy}>© 2026 Twomiah LLC</span>
      </footer>

      {/* Mobile sticky scan CTA */}
      {isMobile && (
        <div style={S.stickyMobile}>
          <div style={S.stickyCopy}>No install. No login.<br/>Scans in your browser.</div>
          <button style={S.stickyBtn} onClick={() => navigate('/scan')}>Try It Now →</button>
        </div>
      )}
    </div>
  );
}
