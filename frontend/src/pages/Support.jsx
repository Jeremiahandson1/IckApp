import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Support() {
  const navigate = useNavigate();

  return (
    <div className="pb-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 mb-6 text-[#888] active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Back</span>
      </button>

      <h1 className="text-2xl font-bold text-[#f4f4f0] mb-6" style={{ fontFamily: 'var(--font-display)' }}>
        Support
      </h1>

      <div className="space-y-6 text-sm text-[#bbb] leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Get Help</h2>
          <p>
            Questions, bug reports, feature requests — we read every message.
          </p>
          <p className="mt-3">
            Email us at{' '}
            <a href="mailto:hello@ickthatish.com" className="text-[#c8f135] underline">hello@ickthatish.com</a>
          </p>
          <p className="mt-1 text-xs text-[#888]">We respond within 1–2 business days.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Common Questions</h2>

          <div className="space-y-4 mt-3">
            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f0] mb-1">A barcode won&apos;t scan / shows &quot;not found&quot;</h3>
              <p>We rely on Open Food Facts and USDA databases, which together cover ~3 million products — but not everything. If a product is missing, you can contribute it from the result page (&quot;Add this product&quot;).</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f0] mb-1">How is the health score calculated?</h3>
              <p>
                See our full methodology at{' '}
                <a href="/about-scoring" className="text-[#c8f135] underline">/about-scoring</a>{' '}— it&apos;s based on Nutri-Score plus condition-specific adjustments (heart, diabetes, kidney, thyroid).
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f0] mb-1">Camera permission denied — how do I re-enable?</h3>
              <p><strong>iOS:</strong> Settings &gt; Ick &gt; Camera &gt; toggle on.</p>
              <p><strong>Android:</strong> Settings &gt; Apps &gt; Ick &gt; Permissions &gt; Camera &gt; Allow.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f0] mb-1">How do I delete my account?</h3>
              <p>Profile &gt; Delete Account. This permanently removes your account, pantry, scan history, and family-group membership within 30 days.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f0] mb-1">How do I export my data?</h3>
              <p>Profile &gt; Export My Data. You&apos;ll get a JSON file with everything we have on you.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f0] mb-1">How do I cancel my subscription?</h3>
              <p><strong>iOS:</strong> Settings &gt; [your Apple ID] &gt; Subscriptions &gt; Ick.</p>
              <p><strong>Android:</strong> Play Store &gt; Profile &gt; Payments &amp; subscriptions &gt; Subscriptions &gt; Ick.</p>
              <p><strong>Web:</strong> Profile &gt; Subscription &gt; Manage.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f0] mb-1">Family groups — how many members?</h3>
              <p>Up to 6 family members on a single shared pantry. Each member keeps their own health profile and allergens.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f0] mb-1">Receipt scanning isn&apos;t working</h3>
              <p>Make sure the receipt is well-lit and the full receipt is in frame. Faded thermal receipts may not parse reliably. If it consistently fails, email us a sample (with personal info redacted) so we can improve the parser.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Report a Bug</h2>
          <p>When emailing about a bug, please include:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>What you were doing when it happened</li>
            <li>What you expected vs. what actually happened</li>
            <li>Device + OS version (e.g., iPhone 15 / iOS 18.2)</li>
            <li>A screenshot if you can</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Medical Disclaimer</h2>
          <p>Ick provides informational nutrition guidance. It is not a medical device and is not a substitute for professional medical advice. Always consult your physician or registered dietitian before making dietary changes — especially if you have a health condition.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Privacy</h2>
          <p>
            <a href="/privacy-policy" className="text-[#c8f135] underline">Read our full privacy policy →</a>
          </p>
        </section>
      </div>
    </div>
  );
}
