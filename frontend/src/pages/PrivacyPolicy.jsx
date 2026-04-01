import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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
        Privacy Policy
      </h1>

      <div className="space-y-6 text-sm text-[#bbb] leading-relaxed">
        <p style={{ color: '#888', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          Last updated: March 2026
        </p>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">What We Collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Account info (name, email, ZIP code)</li>
            <li>Products you scan and add to your pantry</li>
            <li>Health conditions and allergen preferences you set</li>
            <li>Family group membership</li>
            <li>Device info for push notifications (if enabled)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">How We Use It</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Personalize your ingredient scores and health condition alerts</li>
            <li>Track your pantry and provide swap recommendations</li>
            <li>Generate your Pantry Health Report</li>
            <li>Send notifications you opt into (pantry reminders, swap alerts)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">What We Don't Do</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>We never sell your personal data to third parties</li>
            <li>We never share your health conditions or allergen data</li>
            <li>We don't use your data for targeted advertising</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Data Storage & Security</h2>
          <p>Your data is stored on encrypted servers. Passwords are hashed with bcrypt. All API traffic uses HTTPS.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Your Rights</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Export:</strong> Download all your data from Profile &gt; Export My Data</li>
            <li><strong>Delete:</strong> Permanently delete your account from Profile &gt; Delete Account</li>
            <li><strong>Corrections:</strong> Edit your profile, allergens, and health conditions at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Third-Party Services</h2>
          <p>We use Open Food Facts for product data (public database). No personal data is sent to them — only UPC codes for product lookups.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Contact</h2>
          <p>Questions about your privacy? Email us at{' '}
            <a href="mailto:hello@ickthatish.com" className="text-[#c8f135] underline">hello@ickthatish.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
