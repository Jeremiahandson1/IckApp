# Ick — Store Submission Metadata

This file contains every piece of text, every form answer, and every checkbox value you will be asked for in **Apple App Store Connect** and the **Google Play Console**. Copy and paste from here. Do not improvise on the legal/compliance answers — they have been chosen deliberately to match what the app actually does.

**Bundle ID:** `com.ickthatish.app`
**Apple App ID:** `6769029765` (already exists in `codemagic.yaml`)
**Contact email:** `hello@ickthatish.com`
**Production URL (placeholder):** `https://ickthatish.com` — **CONFIRM BEFORE SUBMITTING.** Replace every `{{PROD_URL}}` token below if the real URL differs.

---

## Part 1 — Apple App Store Connect

### 1.1 App Information

| Field | Value |
|---|---|
| **App Name** (30 chars max) | `Ick — Food Scanner` |
| **Subtitle** (30 chars max) | `Scan it. Ick it. Swap it.` |
| **Primary Language** | English (U.S.) |
| **Bundle ID** | `com.ickthatish.app` |
| **SKU** | `ICK-IOS-001` |
| **Primary Category** | Health & Fitness |
| **Secondary Category** | Food & Drink |

### 1.2 Promotional Text (170 chars max — editable any time without resubmission)

```
New: family profiles, allergen alerts, and 100+ smart swaps. Scan any barcode and see what's really in your food — in under a second.
```

### 1.3 Description (~3,000 chars, polished marketing copy)

```
Ick is the food scanner that tells you the truth.

Point your camera at any barcode and in under a second you'll see a science-based health score, every harmful additive flagged, and — best of all — healthier alternatives you can actually buy. No fluff. No paid placements. No surprises.

WHY ICK IS DIFFERENT
Most food apps either dumb everything down to a single letter grade or bury you in jargon. Ick splits the difference: a clear 0–100 score on every product, plus the actual reasoning behind it. Tap any score and you'll see exactly which ingredients pulled it up or down, with citations from the AHA, ADA, KDOQI, ATA, and FDA. You're not just told what to eat — you're shown why.

SCAN ANYTHING
• Instant barcode scanning powered by Google ML Kit — works in low light and on damaged labels
• 3 million+ products from Open Food Facts and USDA FoodData Central
• Receipt scanning: snap a photo and Ick parses your whole haul automatically
• Works offline for products you've already scanned

KNOW WHAT'S INSIDE
• Harmful additive warnings with severity levels (mild, moderate, avoid)
• Personal allergen alerts — gluten, dairy, nuts, soy, eggs, shellfish, sesame, and more
• Condition-aware scoring for heart, kidney, diabetes, and thyroid concerns (informational only — always check with your doctor)
• Plain-English explanations of every ingredient you can't pronounce

SWAP SMARTER
• 100+ curated healthier alternatives for the products people scan most
• Side-by-side score comparisons so the upgrade is obvious
• Homemade recipes when a store-bought swap isn't good enough
• In-store availability via local grocery flyers

FAMILY MODE
• Create separate profiles for each member of your household
• Each profile has its own allergens, health conditions, and scoring
• One scan, four verdicts — instantly see who in the family this product is right for

YOUR PANTRY, ORGANIZED
• Add products to your virtual pantry as you scan them
• Get a weekly Pantry Health Report
• Smart shopping lists built from your real eating patterns
• Velocity tracking so you reorder staples before you run out

PRIVACY FIRST
• We never sell your data
• We never share your health conditions or allergens
• No targeted ads, no affiliate kickbacks, no sponsored "recommendations"
• Export or delete everything from your profile any time

FREE FOREVER, WITH OPTIONAL PREMIUM
Unlimited scanning is and always will be free. Premium unlocks pantry management, family profiles, smart lists, and the Pantry Health Report.

Made by a tiny independent team that just wanted to know what's in their kids' snacks. We hope it helps you too.

Questions, suggestions, or just want to say hi? hello@ickthatish.com
```

### 1.4 Keywords (100 chars max, comma-separated, **no spaces after commas**)

```
food,scanner,barcode,nutrition,ingredients,healthy,allergen,additive,nutriscore,swap,pantry,diet
```

(98 characters — checked.)

### 1.5 URLs

| Field | Value |
|---|---|
| **Marketing URL** | `https://ickthatish.com` |
| **Support URL** | `https://ickthatish.com/support` |
| **Privacy Policy URL** | `https://ickthatish.com/privacy-policy` |

### 1.6 What's New in This Version (first release)

```
Welcome to Ick! This is our first release. Scan any food barcode for an instant 0–100 health score, additive and allergen warnings, and smarter swaps you can actually buy. Family profiles, pantry tracking, and condition-aware scoring included. We'd love your feedback — hello@ickthatish.com.
```

### 1.7 Age Rating Questionnaire

Apple asks you to rate the *frequency* of each kind of content. Answer **None** for every row below unless explicitly noted.

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | **None** |
| Realistic Violence | **None** |
| Prolonged Graphic or Sadistic Realistic Violence | **None** |
| Profanity or Crude Humor | **None** |
| Mature/Suggestive Themes | **None** |
| Horror/Fear Themes | **None** |
| Medical/Treatment Information | **Infrequent/Mild** *(scoring references clinical guidelines, but the app is informational, not diagnostic)* |
| Alcohol, Tobacco, or Drug Use or References | **None** |
| Sexual Content or Nudity | **None** |
| Graphic Sexual Content and Nudity | **None** |
| Simulated Gambling | **None** |
| Contests | **None** |
| Unrestricted Web Access | **No** |
| Gambling and Contests | **No** |

**Resulting age rating:** **4+**

### 1.8 Export Compliance

| Question | Answer |
|---|---|
| Does your app use encryption? | **Yes** |
| Does it qualify for an exemption under Category 5, Part 2 of the U.S. Export Administration Regulations? | **Yes** |
| Reason for exemption | **(b) Uses standard encryption algorithms only (HTTPS/TLS) and does not implement, support, or incorporate any proprietary or non-standard cryptographic functionality.** Exempt under **5D002**. |
| Does your app use exempt encryption? | **Yes** |
| Have you submitted a year-end self-classification report to the U.S. Bureau of Industry and Security? | **No** (not required for apps using only standard HTTPS) |

### 1.9 Content Rights

| Question | Answer |
|---|---|
| Does your app contain, display, or access third-party content? | **Yes** |
| Do you have all necessary rights to that content? | **Yes** |

**Explanation if asked:** Product data is sourced from **Open Food Facts** (Open Database License, ODbL) and **USDA FoodData Central** (U.S. public domain). All scoring logic, ingredient analysis, recipe content, swap recommendations, and UI are original works owned by the developer.

### 1.10 App Review Information (notes to Apple's reviewer)

```
Ick is a food barcode scanner with a 0–100 health score and personalized
allergen / health-condition warnings. The app works without an account — just
scan any food barcode (e.g., the test code 0049000028904 = Coca-Cola).

To test signed-in features (pantry, family profiles, premium), use:

  Email:    apple-review@ickthatish.com
  Password: {{REVIEW_PASSWORD}}

This account has Premium pre-enabled so you can exercise every feature.

Notes for review:
• Camera permission: required for barcode scanning. The prompt fires on the Scan tab.
• Push notifications: optional. Used for pantry reminders the user opts into.
• In-app purchases: Premium subscription processed via Stripe (web checkout opened
  from the app). All purchases are restorable per the user's account.
• Medical disclaimer is shown on first launch and in Settings > About Scoring.
  The app is informational only, not a medical device.

Contact: hello@ickthatish.com
```

> Replace `{{REVIEW_PASSWORD}}` with a real working password before you submit. Write it down somewhere safe.

### 1.11 Sign-In Information (if Apple flags it)

| Field | Value |
|---|---|
| Sign-in required to use app? | **No** (scanning works without an account) |
| Demo account username | `apple-review@ickthatish.com` |
| Demo account password | `{{REVIEW_PASSWORD}}` |

---

## Part 2 — Google Play Console

### 2.1 Store Listing

| Field | Limit | Value |
|---|---|---|
| **App title** | 30 chars | `Ick: Food Scanner & Score` |
| **Short description** | 80 chars | `Scan food barcodes for instant health scores, ingredient alerts & swaps.` |

### 2.2 Full Description (4,000 chars max)

```
Ick is the food scanner that tells you the truth.

Point your camera at any barcode and in under a second you'll see a science-based health score, every harmful additive flagged, and healthier alternatives you can actually buy. No fluff, no paid placements, no surprises.

★ WHY ICK IS DIFFERENT
Most food apps either dumb everything down to a single letter grade or drown you in jargon. Ick splits the difference: a clear 0–100 score on every product, plus the actual reasoning behind it. Tap any score and you'll see exactly which ingredients pulled it up or down, with citations from the American Heart Association, American Diabetes Association, KDOQI, American Thyroid Association, and the FDA.

★ SCAN ANYTHING
• Instant barcode scanning powered by Google ML Kit — works in low light and on damaged labels
• 3 million+ products from Open Food Facts and USDA FoodData Central
• Receipt scanning — snap a photo and Ick parses the whole haul
• Cached results work offline

★ KNOW WHAT'S INSIDE
• Harmful additive warnings with severity levels
• Personal allergen alerts — gluten, dairy, nuts, soy, eggs, shellfish, sesame, and more
• Condition-aware scoring for heart, kidney, diabetes, and thyroid concerns (informational only — always check with your doctor)
• Plain-English explanations of unfamiliar ingredients

★ SWAP SMARTER
• 100+ curated healthier alternatives for popular products
• Side-by-side score comparisons
• Homemade recipes when a store-bought swap isn't good enough
• In-store availability via local grocery flyers

★ FAMILY MODE
• Separate profile for every household member
• Each profile gets its own allergens, conditions, and scoring
• One scan, multiple verdicts — instantly see who this product is right for

★ YOUR PANTRY, ORGANIZED
• Add products to your virtual pantry as you scan them
• Weekly Pantry Health Report
• Smart shopping lists built from your real eating patterns
• Velocity tracking so you reorder staples before you run out

★ PRIVACY FIRST
• We never sell your data
• We never share your health conditions or allergens
• No targeted ads, no affiliate kickbacks, no sponsored "recommendations"
• Export or delete everything from your profile any time

★ FREE FOREVER, WITH OPTIONAL PREMIUM
Unlimited scanning is and always will be free. Premium unlocks pantry management, family profiles, smart lists, and the Pantry Health Report.

Made by a tiny independent team that just wanted to know what's in their kids' snacks. We hope it helps you too.

Questions or suggestions? hello@ickthatish.com
```

### 2.3 Category, Tags, Contact

| Field | Value |
|---|---|
| **App category** | Health & Fitness |
| **Tags** (Play lets you pick up to 5) | Nutrition, Healthy living, Food & drink reference, Calorie counter, Diet |
| **Email** | `hello@ickthatish.com` |
| **Website** | `https://ickthatish.com` |
| **Privacy policy URL** | `https://ickthatish.com/privacy-policy` |
| **Phone** | (optional — leave blank) |

### 2.4 Data Safety Form

This is the section that gets apps rejected most often. The answers below match exactly what `PrivacyPolicy.jsx` discloses. Do not deviate.

**General questions**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS / TLS on every endpoint) |
| Do you provide a way for users to request that their data be deleted? | **Yes** — in-app at **Profile > Delete Account**, or by emailing `hello@ickthatish.com` |

**Data types collected, why, and whether shared**

For every row: **Collected = Yes**, **Shared = No** unless noted. "Optional" means the user can use the app without providing it.

| Data type | Collected? | Shared? | Why | Optional? |
|---|---|---|---|---|
| **Name** | Yes | No | Account identification | Optional |
| **Email address** | Yes | Yes — to **Resend** for transactional email delivery only | Account login, password reset, family invites | Required for account |
| **User ID** | Yes | No | Account management | Required for account |
| **Address — Approximate (ZIP code only)** | Yes | No | Local grocery flyer matching (Flipp) | Optional |
| **Phone number** | Yes (recipient's, only when sending an SMS family invite) | Yes — to **Twilio** to deliver the SMS | Family-group invites by SMS | Optional |
| **Payment info** | Yes | Yes — to **Stripe** | Premium subscription billing | Optional (only premium subscribers) |
| **Purchase history** | Yes | No | Show user's subscription status | Optional |
| **Health info — Other health info** (allergens, health conditions) | Yes | No | Personalized scoring and allergen alerts | Optional |
| **App interactions** (products scanned, pantry contents) | Yes | No | Core app functionality, pantry features, Health Report | Required to use scanning features |
| **Photos** (receipts only, if user scans a receipt) | Yes | Yes — to **OpenAI** for receipt parsing only | Receipt-to-pantry feature | Optional |
| **Device or other IDs** (push token) | Yes | Yes — to **Apple APNs** and **Google FCM** | Deliver push notifications the user opted into | Optional |
| **Crash logs** | Yes | No | Stability monitoring | Required (no opt-out) |
| **Diagnostics** | Yes | No | Performance monitoring | Required (no opt-out) |

**Third parties to disclose if Play asks for an itemized list:**

- Open Food Facts (UPC lookups only, no personal data)
- USDA FoodData Central (UPC lookups only, no personal data)
- OpenAI (receipt parsing — image only, only if user uses that feature)
- Stripe (payments — only if user subscribes)
- Twilio (outbound SMS — only if user sends an SMS family invite)
- Resend (transactional email — verification, password reset, invites)
- Flipp (public flyer crawl — no personal data sent)
- Apple APNs / Google FCM (push tokens, only if user enables notifications)

### 2.5 Content Rating (IARC Questionnaire)

Pick **Reference, News, or Educational** as the closest category. Answer **No** to every item below.

| Question | Answer |
|---|---|
| Does the app contain violence? | **No** |
| Does the app contain sexual content? | **No** |
| Does the app contain bad language / profanity? | **No** |
| Does the app contain controlled substances (drugs, alcohol, tobacco)? | **No** |
| Does the app contain simulated gambling? | **No** |
| Does the app allow users to interact / share user-generated content? | **No** (family group members share data with each other only; no public UGC) |
| Does the app share the user's physical location with other users? | **No** |
| Does the app allow users to purchase digital goods? | **Yes** (Premium subscription via Stripe — disclosed) |
| Does the app collect or share personal info? | **Yes** (per Data Safety form above) |

**Expected resulting rating:** **IARC 3+ / ESRB Everyone / PEGI 3 / USK 0**

### 2.6 Target Audience and Content

| Field | Value |
|---|---|
| **Target age groups** | **13+** |
| **Appeals to children?** | **No** |
| **Does the app unintentionally appeal to children?** | **No** |

### 2.7 Ads

| Field | Value |
|---|---|
| **Contains ads?** | **No** |

### 2.8 In-App Purchases

| Field | Value |
|---|---|
| **Contains in-app purchases?** | **Yes** |
| **Type** | Subscription (Stripe-driven, fulfilled via web checkout opened from the app) |
| **Price tiers** | `Ick Premium Monthly — $4.99/mo` · `Ick Premium Annual — $39.99/yr` |

> Note: Because billing is handled by **Stripe** (a web checkout opened from the app, for a service consumed outside the app), this falls under Play's allowance for external digital-service billing **only if** the subscription is sold and consumed outside of Play's IAP scope. If Play's review team disagrees, the fallback is Google Play Billing for digital goods consumed inside the app. Confirm policy fit with Play before launch — if in doubt, gate Premium purchases behind a web-only flow on Android and disclose accordingly.

### 2.9 Other Declarations

| Question | Answer |
|---|---|
| Is this a news app? | **No** |
| Is this a COVID-19 contact-tracing or status app? | **No** |
| Is this a government app? | **No** |
| Financial features? | **No** |
| Health features? | **Yes** — informational nutrition guidance only, not a medical device, disclaimer surfaced in-app |

---

## Part 3 — Cross-Reference With Privacy Policy

Every third party and every data type listed above is **already disclosed** in `frontend/src/pages/PrivacyPolicy.jsx`. Summary cross-check:

| Disclosed in privacy policy | Reflected in Apple? | Reflected in Play Data Safety? |
|---|---|---|
| Name, email, ZIP code | ✅ | ✅ |
| Products scanned & pantry contents | ✅ (App interactions) | ✅ |
| Health conditions & allergens | ✅ (Health info) | ✅ |
| Family group membership | ✅ (covered under App interactions / User ID) | ✅ |
| Device push token | ✅ | ✅ |
| Open Food Facts, USDA (no personal data) | n/a — no PII shared | n/a — no PII shared |
| OpenAI (receipt image) | ✅ | ✅ |
| Stripe (payment info) | ✅ | ✅ |
| Twilio (recipient SMS) | ✅ | ✅ |
| Resend (email delivery) | ✅ | ✅ |
| Flipp (no personal data) | n/a | n/a |
| Apple APNs / Google FCM (push token) | ✅ | ✅ |

If you change the privacy policy, update this file the same day. Mismatch between disclosed and declared is the #1 rejection cause on Play.

---

_End of metadata. Hand this file to anyone filling out the store listing forms — every blank should be answerable from this document alone._
