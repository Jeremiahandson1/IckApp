import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
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
        Terms of Service
      </h1>

      <div className="space-y-6 text-sm text-[#bbb] leading-relaxed">
        <p style={{ color: '#888', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          Last updated: May 2026
        </p>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Acceptance</h2>
          <p>By using IckThatIsh ("Ick," "the app," "the service"), you agree to these Terms of Service and our <a href="/privacy-policy" className="text-[#c8f135] underline">Privacy Policy</a>. If you don't agree, please don't use the service.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">What Ick Is</h2>
          <p>Ick is an informational food-scanning app that lets you scan product barcodes, view ingredient analyses and health scores, save a pantry, track progress, and get suggested product swaps. Some features (pantry management, family sharing) require a free account. Some features (Pantry Health Audit, Smart Shopping Lists, In-Store Shopping Mode) require a paid Premium subscription.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Account Terms</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>You must be at least 13 years old to create an account.</li>
            <li>You're responsible for keeping your password secure and for any activity under your account.</li>
            <li>Provide accurate information when registering. You can update or delete your account at any time from Profile.</li>
            <li>Don't share your account with others. Use Family Sharing instead — it's built for households.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Acceptable Use</h2>
          <p className="mb-2">Don't use Ick to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Scrape, copy, or redistribute the product database, scores, or methodology in bulk.</li>
            <li>Submit false product information, false reviews, or spam contributions.</li>
            <li>Reverse-engineer, decompile, or attempt to extract source code.</li>
            <li>Harass, impersonate, or harm other users via family-group features or invites.</li>
            <li>Use the service in ways that violate any applicable law.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Premium Subscription</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Premium is billed monthly ($4.99/month) or annually ($39.99/year) via Stripe.</li>
            <li>Subscriptions auto-renew until you cancel. You can cancel any time from Profile &gt; Subscription — cancellation takes effect at the end of your current billing period.</li>
            <li>Refunds are handled per Stripe's standard refund policies. For pro-rata refunds outside standard policy, contact hello@ickthatish.com.</li>
            <li>Premium features may change as the product evolves. We'll give reasonable notice of material changes.</li>
            <li>If your payment fails and isn't resolved, Premium features will be disabled until billing is restored. Your free-tier access continues uninterrupted.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Medical Disclaimer</h2>
          <p>Ick is an informational tool, not a medical device or a substitute for medical advice. The 5-Dimension Score, condition-specific scores, and ingredient warnings are based on published clinical guidelines (AHA, ADA, KDOQI, ATA, FDA) and public data sources, but do not account for your medications, lab values, allergies beyond what you've set, or individual clinical context.</p>
          <p className="mt-2"><strong className="text-[#f4f4f0]">Always consult your physician or registered dietitian before making dietary changes based on a health condition.</strong> Do not rely on Ick to diagnose or treat any medical condition. If you have a severe allergy, always read the product label yourself — ingredient data can be incomplete or out of date.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Product Data Sources</h2>
          <p>Product information is sourced from Open Food Facts (Open Database License, ODbL), USDA FoodData Central (U.S. public domain), and user contributions. Scoring logic, ingredient analyses, swap recommendations, recipes, and the user interface are original works owned by Twomiah LLC.</p>
          <p className="mt-2">Product scores can change as our methodology improves or as source data is updated. We don't guarantee that any specific product will retain the same score over time.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">User Contributions</h2>
          <p>If you submit product corrections, missing-product reports, or other content to Ick, you grant us a non-exclusive, royalty-free, worldwide license to use, modify, and incorporate that content into the service. Don't submit anything you don't have the right to share.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">No Brand Money</h2>
          <p>We do not accept paid product placements, sponsored swap recommendations, or fees from brands to improve their scores. If you suspect a score has been manipulated, report it to hello@ickthatish.com and we'll investigate.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Twomiah LLC and its contributors are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of Ick — including but not limited to health outcomes, missed allergens, incorrect scores, or product decisions influenced by the app. Our total liability for direct damages is limited to the amount you paid for Premium in the 12 months preceding the claim, if any.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Service Changes &amp; Termination</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>We may add, change, or remove features at any time. We'll communicate material changes via email or in-app notice.</li>
            <li>You can delete your account at any time from Profile &gt; Delete Account.</li>
            <li>We may suspend or terminate accounts that violate these Terms, with notice when feasible.</li>
            <li>If the service shuts down, we'll provide reasonable notice and an opportunity to export your data.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Governing Law</h2>
          <p>These Terms are governed by the laws of the State of Wisconsin, United States, without regard to conflict-of-law principles. Any dispute will be resolved in the state or federal courts located in Eau Claire County, Wisconsin, unless a different jurisdiction is required by your local consumer-protection law.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Changes to These Terms</h2>
          <p>We may update these Terms from time to time. Material changes will be communicated in-app or by email. Continued use of the service after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Contact</h2>
          <p>Questions about these Terms? Email us at{' '}
            <a href="mailto:hello@ickthatish.com" className="text-[#c8f135] underline">hello@ickthatish.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
