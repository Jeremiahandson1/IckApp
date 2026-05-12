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
          Last updated: May 2026
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
          <p className="mb-3">We rely on the following third parties to operate Ick. Where personal data is shared, the scope is described below.</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong className="text-[#f4f4f0]">Open Food Facts</strong> — product database. We send only UPC barcodes for lookups. No personal data.
            </li>
            <li>
              <strong className="text-[#f4f4f0]">USDA FoodData Central</strong> — secondary product database. UPC lookups only. No personal data.
            </li>
            <li>
              <strong className="text-[#f4f4f0]">OpenAI</strong> — receipt parsing (only if you scan a receipt). When you use receipt scanning, the receipt image is sent to OpenAI's GPT-4o vision API for parsing. OpenAI may retain this image per their API data policies. <em>Do not scan receipts containing information you don't want shared with OpenAI.</em>
            </li>
            <li>
              <strong className="text-[#f4f4f0]">Stripe</strong> — payment processing (only if you subscribe). Billing details (name, card info, billing address) go directly to Stripe; we never see your card number.
            </li>
            <li>
              <strong className="text-[#f4f4f0]">Twilio</strong> — SMS delivery (only if you send a family-group invite by SMS). The recipient's phone number and invite link are sent through Twilio.
            </li>
            <li>
              <strong className="text-[#f4f4f0]">Resend</strong> — transactional email (account verification, password reset, family-group email invites). Your email address is processed by Resend to deliver these messages.
            </li>
            <li>
              <strong className="text-[#f4f4f0]">Flipp</strong> — grocery flyer data for in-store availability. We do not send personal data; we crawl public flyer listings.
            </li>
            <li>
              <strong className="text-[#f4f4f0]">Push notification services</strong> — Apple APNS and Google FCM, if you enable notifications. Your device push token is required.
            </li>
          </ul>
          <p className="mt-3 text-xs text-[#888]">If you disable a feature (e.g., never scan a receipt, never subscribe), the corresponding third party never receives your data.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#f4f4f0] mb-2">Medical Disclaimer</h2>
          <p>Ick provides informational nutrition guidance. Condition-specific scoring is grounded in published clinical guidelines (AHA, ADA, KDOQI, ATA, FDA) but is not personalized to your labs, medications, or clinical context. Ick is not a medical device. Always consult your physician or registered dietitian before making dietary changes based on a health condition.</p>
          <p className="mt-2">
            <a href="/about-scoring" className="text-[#c8f135] underline">Read the full scoring methodology and citation list →</a>
          </p>
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
