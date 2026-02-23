import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const S = {
  page:       { background: '#0a0a0a', color: '#f4f4f0', fontFamily: 'var(--font-body)', minHeight: '100vh', overflowX: 'hidden' },
  nav:        { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a' },
  logo:       { fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '3px', color: '#c8f135', textDecoration: 'none' },
  logoSub:    { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', display: 'block', marginTop: '-2px' },
  navBtn:     { background: '#c8f135', color: '#0a0a0a', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 700 },
  hero:       { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '100px 24px 48px', position: 'relative', overflow: 'hidden' },
  heroBg:     { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: 'var(--font-display)', fontSize: 'clamp(140px, 40vw, 420px)', color: 'transparent', WebkitTextStroke: '1px rgba(200,241,53,0.04)', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', letterSpacing: '20px' },
  eyebrow:    { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#c8f135', marginBottom: '16px' },
  heroH1:     { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 16vw, 140px)', lineHeight: '0.92', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px' },
  heroAccent: { color: '#c8f135', display: 'block' },
  heroStroke: { color: 'transparent', WebkitTextStroke: '2px #f4f4f0', display: 'block' },
  heroSub:    { fontSize: 'clamp(15px, 2.5vw, 18px)', fontWeight: 300, color: 'rgba(244,244,240,0.65)', maxWidth: '480px', lineHeight: 1.6, marginBottom: '36px' },
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
  stepTitle:  { fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' },
  stepBody:   { fontSize: '14px', color: 'rgba(244,244,240,0.55)', lineHeight: 1.6, fontWeight: 300 },
  emailWrap:  { padding: '80px 24px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' },
  emailH2:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 10vw, 88px)', lineHeight: '0.95', textTransform: 'uppercase', marginBottom: '20px' },
  emailSub:   { color: 'rgba(244,244,240,0.55)', fontSize: '16px', fontWeight: 300, marginBottom: '36px' },
  emailForm:  { display: 'flex', maxWidth: '420px', margin: '0 auto 16px' },
  emailInput: { flex: 1, background: '#161616', border: '1px solid #2a2a2a', borderRight: 'none', color: '#f4f4f0', fontFamily: 'var(--font-body)', fontSize: '14px', padding: '14px 16px', outline: 'none' },
  emailSubmit:{ background: '#c8f135', color: '#0a0a0a', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '14px 20px', cursor: 'pointer', whiteSpace: 'nowrap' },
  footer:     { borderTop: '1px solid #1e1e1e', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  footerLogo: { fontFamily: 'var(--font-display)', fontSize: '20px', color: '#c8f135', letterSpacing: '2px' },
  footerSub:  { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '3px', color: '#444', textTransform: 'uppercase', display: 'block', marginTop: '2px' },
  footerCopy: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#333', letterSpacing: '1px' },
};

const banned = [
  { name: 'Red Dye 40', foundIn: 'Doritos · Froot Loops · M&Ms · Jell-O', bans: ['Banned: EU*', 'Banned: UK*'], ok: ['Allowed: USA'], note: '*Requires "may affect activity in children" warning label' },
  { name: 'Brominated Veg. Oil', foundIn: 'Mountain Dew · Citrus Sports Drinks', bans: ['Banned: EU', 'Banned: Japan', 'Banned: India'], ok: ['Allowed: USA'], note: 'Bromine accumulates in tissue. FDA banned it in 2024 — still in supply chains.' },
  { name: 'Titanium Dioxide', foundIn: 'Skittles · Chewing Gum · Frosting · Ranch', bans: ['Banned: France 2020', 'Banned: EU 2022'], ok: ['Allowed: USA'], note: 'Used purely for whitening. EFSA: can no longer be considered safe.' },
  { name: 'Potassium Bromate', foundIn: 'Bread · Rolls · Bagels · Pizza Dough', bans: ['Banned: EU', 'Banned: UK', 'Banned: Canada'], ok: ['Allowed: USA'], note: 'IARC classifies it as a possible human carcinogen. Banned in 20+ countries.' },
  { name: 'BHA / BHT', foundIn: 'Cereal · Potato Chips · Chewing Gum · Butter', bans: ['Banned: Japan', 'Restricted: EU'], ok: ['Allowed: USA'], note: 'BHA listed as "reasonably anticipated to be a human carcinogen" by US Dept of Health.' },
  { name: 'TBHQ', foundIn: 'Pop-Tarts · Ramen · McDonald\'s Nuggets', bans: ['Banned: Japan', 'Banned: EU'], ok: ['Allowed: USA'], note: 'Derived from petroleum. High doses linked to tumors in animal studies.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const msgRef = useRef(null);

  useEffect(() => {
    // Add marquee keyframe
    const style = document.createElement('style');
    style.textContent = `@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (msgRef.current) {
      msgRef.current.textContent = '✓ You\'re on the list.';
      msgRef.current.style.color = '#c8f135';
    }
  }

  const marqueeItems = [
    ['Red 40', true], ['Banned in EU', false], ['BHA / BHT', true], ["In Your Kids' Cereal", false],
    ['Titanium Dioxide', true], ['Banned in France 2020', false], ['TBHQ', true], ['Banned in Japan', false],
    ['Brominated Veg. Oil', true], ['Still in Your Sports Drink', false], ['Potassium Bromate', true], ['Banned in 20+ Countries', false],
  ];

  return (
    <div style={S.page}>
      {/* NAV */}
      <nav style={S.nav}>
        <div>
          <span style={S.logo}>ICKTHATISH</span>
          <span style={S.logoSub}>by Twomiah</span>
        </div>
        <button style={S.navBtn} onClick={() => navigate('/scan')}>Start Scanning →</button>
      </nav>

      {/* HERO */}
      <section style={S.hero}>
        <div style={S.heroBg}>ICK</div>
        <p style={S.eyebrow}>Food Transparency App</p>
        <h1 style={S.heroH1}>
          <span>Your</span>
          <span style={S.heroAccent}>Grocery</span>
          <span style={S.heroStroke}>Store</span>
          <span>Lied.</span>
        </h1>
        <p style={S.heroSub}>
          Scan any product. See every ingredient <strong style={{ color: '#f4f4f0' }}>banned in Europe</strong> that's still in your food.
          Find a clean swap you can actually buy nearby.
        </p>
        <div style={S.actions}>
          <button style={S.btnPrimary} onClick={() => navigate('/scan')}>Scan a Product →</button>
          <button style={S.btnSecondary} onClick={() => navigate('/register')}>Create Free Account</button>
        </div>
        <div style={S.statRow}>
          {[['845K+','Products Indexed'],['53','Flagged Ingredients'],['100+','Clean Swaps'],['0','Brand Deals. Ever.']].map(([n,l]) => (
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '48px', alignItems: 'end' }}>
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

      {/* HOW IT WORKS */}
      <section style={S.section}>
        <p style={S.label}>How It Works</p>
        <h2 style={S.sectionH2}>Simple.<br/><span style={{ color: '#c8f135' }}>Brutal.</span><br/>Honest.</h2>
        <div style={S.grid3}>
          {[
            { n:'1', icon:'📷', title:'Scan the Barcode', body:'Point your camera at any product. IckThatIsh pulls from 845,000+ products with full ingredient data.' },
            { n:'2', icon:'🔬', title:'See the Truth', body:'Every flagged ingredient explained — what it does, why companies use it, and which countries banned it.' },
            { n:'3', icon:'✅', title:'Get a Real Swap', body:'A cleaner alternative with a better score — and which stores near you carry it. Not a paid placement. The actual best option.' },
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

      {/* CTA */}
      <section style={S.emailWrap} id="notify">
        <p style={{ ...S.label, display: 'inline-block', marginBottom: '16px' }}>Free to Use</p>
        <h2 style={S.emailH2}>Stop<br/>Eating<br/><span style={{ color: '#c8f135' }}>The Ick.</span></h2>
        <p style={S.emailSub}>No account required to scan. Create a free account to save your pantry, set allergen alerts, and track your swaps.</p>
        <div style={S.actions} id="cta-actions" className="justify-center">
          <button style={S.btnPrimary} onClick={() => navigate('/scan')}>Scan Now — It's Free →</button>
          <button style={S.btnSecondary} onClick={() => navigate('/register')}>Create Account</button>
        </div>
        <form style={S.emailForm} onSubmit={handleSubmit}>
          <input style={S.emailInput} type="email" placeholder="Get launch updates via email" required />
          <button style={S.emailSubmit} type="submit">Notify Me</button>
        </form>
        <p ref={msgRef} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#444' }}>No spam. No brand deals. No BS.</p>
      </section>

      {/* FOOTER */}
      <footer style={S.footer}>
        <div>
          <div style={S.footerLogo}>ICKTHATISH</div>
          <span style={S.footerSub}>A Twomiah Product · Eau Claire, WI</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Privacy','Terms','Contact'].map(l => (
            <span key={l} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#444', cursor: 'pointer' }}>{l}</span>
          ))}
        </div>
        <span style={S.footerCopy}>© 2026 Twomiah LLC</span>
      </footer>
    </div>
  );
}
