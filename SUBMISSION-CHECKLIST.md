# Ick — Submission Day Checklist

This is the step-by-step playbook for getting Ick into the **Apple App Store** and the **Google Play Store**. Work top to bottom. Every answer you need for forms is in `STORE-SUBMISSION.md` — keep it open in another tab.

**Bundle ID:** `com.ickthatish.app`
**Apple App ID:** `6769029765` (already exists)
**Contact email:** `hello@ickthatish.com`

**Estimated time for Jeremiah:**
- 🍎 **iOS: 60–90 minutes** (excluding Apple review time, which is typically 24h–7 days)
- 🤖 **Android: 60–90 minutes** of work (excluding Google's mandatory **14-day closed-testing wait** with **20 testers** — see Step B-3)

---

## ⚠️ Read This First — The Android 14-Day Rule

Google now requires new personal developer accounts to run a **closed test with at least 20 active testers for at least 14 continuous days** before any first-time production release is allowed. **This is not optional and cannot be bypassed.** Plan around it: start the closed test **at least two weeks before** your target launch date.

If Jeremiah's Play account is a **registered organization** (not personal), this rule does **not** apply. Confirm which account type is in use at Play Console > Settings > Developer account > Account details.

---

## Part 0 — Required Artifacts Checklist

Tick these off **before** you open either console. If any are red, fix them first or the submission will stall.

- [x] **1024×1024 master icon** → `frontend/public/icons/icon-1024.png` — **DONE** ✅
  *Built from the 512 artwork: 1024×1024, sRGB, opaque (no alpha channel), no pre-rounded corners — iOS applies its own mask. This file is the single master; every other icon is derived from it by `frontend/scripts/generate-icons.js`.*
- [x] **Native launcher icons + splash generated in CI** — **DONE** ✅
  *`frontend/ios/` and `frontend/android/` are gitignored and Codemagic recreates them with `cap add` on every build, so anything committed into them is discarded. Both workflows now run `node scripts/generate-icons.js && npx capacitor-assets generate` after `cap add` and before the build, with a guard that fails the build if the icons didn't land. Before this, CI shipped Capacitor's default placeholder icon — an automatic rejection on both stores.*
- [x] **Splash screen shows Ick branding** — **DONE** ✅
  *The previous splash screens still read "ScanAndSwap — Know better. Swap smarter." on a green gradient, which contradicts the store listing name. Regenerated on brand dark `#0a0a0a` with the Ick mark.*
- [x] **`VITE_API_URL` baked into native builds** — **DONE** ✅
  *`api.js` falls back to a relative `/api`, which on a device resolves against the WebView origin (`capacitor://localhost`) rather than the server — every API call would 404 in a build that otherwise looked healthy. Both Codemagic workflows now set `VITE_API_URL: https://ickthatish.com/api`.*
- [x] **Privacy policy page** — **DONE** ✅ (lives at `/privacy-policy`)
- [x] **Support page** at `/support` — **DONE** ✅ (built in this prep pass)
- [x] **Privacy policy + support hosted at public HTTPS URLs** — **VERIFIED** ✅
  *`https://ickthatish.com`, `/privacy-policy`, and `/support` all return `200`. The API is live at `https://ickthatish.com/api` (same origin — Render serves frontend and backend together).*
- [ ] **`google-services.json`** in `frontend/android/app/` — **STILL MISSING** ❌ *(needs Firebase Console access — cannot be generated from the repo)*
  *Fix: Firebase Console > Project Settings > General > Your apps > Android > Download `google-services.json`.*
  *⚠️ Because `frontend/android/` is gitignored and recreated on every CI build, dropping the file there locally will NOT reach Codemagic. Commit it somewhere tracked (e.g. `frontend/android-config/google-services.json`) and add a copy step to the Android workflow, or add it as an encrypted file in the Codemagic UI. Without this, Android push notifications will not register.*
- [ ] **APNs auth key `.p8`** uploaded to push backend — **UNKNOWN** ❓
  *Check: Apple Developer > Keys. If a key with "Apple Push Notifications service (APNs)" is listed, download and upload to whatever push provider the backend uses. If not, create one.*
- [ ] **Screenshots — 6 iOS (6.7" iPhone + 5.5" iPhone) + 6 Android (phone + 7" tablet)** — **STILL MISSING** ❌ *(needs a simulator/emulator or a real device — an iOS simulator is macOS-only, so this can't be done from the Windows dev box)*
  *Fix: easiest path is to install the TestFlight build on a real iPhone and screenshot it, then an Android emulator or device for the Play set. Place them in `frontend/assets/screenshots/ios/` and `frontend/assets/screenshots/android/`. The 6 frames listed in `NATIVE.md` (scan, result, swap, allergen, recipe, onboarding) are the right set.*
  *Note: `frontend/assets/` also holds the generated Capacitor icon/splash sources — keep screenshots in their own subfolders so `capacitor-assets` doesn't pick them up.*
- [x] **App Store Connect app entry exists** — **LIKELY DONE** ✅
  *Confirmed by presence of `APP_STORE_APP_ID: 6769029765` in `codemagic.yaml`. Verify by logging in and looking for "Ick" in My Apps. If not visible, follow Step A-1.*
- [ ] **Google Play Console app entry** — **TODO** ❌
- [ ] **Codemagic Google Play service-account credential** — **TODO** ❌
  *Fix: Play Console > Setup > API access > Create new service account (Google Cloud) > grant "Release manager" role > download JSON key > add as `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` in Codemagic env. Or skip and do the first AAB upload manually.*
- [ ] **Production URL with HTTPS confirmed reachable** — **UNKNOWN** ❓
  *Fix: `curl -I https://ickthatish.com` should return `200`. Update `STORE-SUBMISSION.md` if the real URL is different.*

---

## Part A — iOS / Apple App Store (60–90 min)

### A-1. Confirm the App Store Connect entry exists

1. Sign in to **https://appstoreconnect.apple.com**.
2. Click **My Apps**.
3. Look for **Ick** with App ID `6769029765`.
   - **If it's there →** skip to A-2.
   - **If not →** click the blue **+** at top left > **New App**. Fill in:
     - Platform: **iOS**
     - Name: `Ick — Food Scanner`
     - Primary Language: **English (U.S.)**
     - Bundle ID: `com.ickthatish.app` (must already be registered in Certificates, Identifiers & Profiles)
     - SKU: `ICK-IOS-001`
     - User Access: **Full Access**

### A-2. App Information page

Path: My Apps > **Ick** > **App Information** (left sidebar).

Fill in from `STORE-SUBMISSION.md` §1.1, §1.5, §1.9:
- Subtitle, Primary Category (**Health & Fitness**), Secondary Category (**Food & Drink**)
- Privacy Policy URL: `https://ickthatish.com/privacy-policy`
- Content Rights (Yes / Yes) — §1.9
- Age Rating — click **Edit**, answer every row per §1.7, save. The system should compute **4+**.

### A-3. Pricing & Availability

Path: My Apps > **Ick** > **Pricing and Availability**.
- **Price:** Free (Premium is handled outside of App Store IAP via Stripe)
- **Availability:** All countries and regions
- **App Distribution Methods:** Public on App Store

### A-4. Upload the 1024 icon

The 1024 icon is part of the metadata, not the binary. Path: My Apps > **Ick** > **App Store** tab > **1.0 Prepare for Submission** > scroll to **App Icon** > drag in `frontend/public/icons/icon-1024.png`.

### A-5. Fill in the version metadata (Version 1.0)

Path: My Apps > **Ick** > **App Store** tab > **1.0 Prepare for Submission**.

Copy from `STORE-SUBMISSION.md`:
- **Promotional Text** — §1.2
- **Description** — §1.3
- **Keywords** — §1.4
- **Support URL** — §1.5
- **Marketing URL** — §1.5
- **What's New in This Version** — §1.6
- **Copyright** — `© 2026 Twomiah`
- **App Review Information** — §1.10 (don't forget to replace `{{REVIEW_PASSWORD}}`)
- **Version Release** — choose "Automatically release this version" unless you want to time the launch manually.

### A-6. Upload screenshots

Same page, scroll to **iPhone Screenshots**.
- Upload 3–6 shots in **6.7" Display** (1290×2796 — iPhone 15 Pro Max) from `frontend/assets/screenshots/ios/6.7/`.
- Upload 3–6 shots in **5.5" Display** (1242×2208 — iPhone 8 Plus) from `frontend/assets/screenshots/ios/5.5/`.
- Order matters — Apple shows them left-to-right in the order you upload.

### A-7. Build & upload the binary via Codemagic

1. Make sure the **iOS workflow** in `codemagic.yaml` is wired to TestFlight (it already is).
2. Push to `main` (or trigger the workflow manually in Codemagic UI).
3. Wait ~20–30 min for the build to complete.
4. Codemagic uploads to TestFlight automatically. You'll get an email when processing finishes (another 10–20 min).

### A-8. Verify in TestFlight

Path: My Apps > **Ick** > **TestFlight** tab.
- Confirm the new build (e.g., `1.0 (1)`) shows as **Ready to Submit** or **Ready to Test**.
- Apple will flag any **Export Compliance** prompt — answer per §1.8 (uses standard encryption, exempt under 5D002).

### A-9. Add internal testers (optional but recommended)

Same tab > **Internal Testing** > **+** > select the App Store Connect users you want to test. Hit them in iMessage to install TestFlight and confirm the app launches.

### A-10. Submit for App Store review

Path: My Apps > **Ick** > **App Store** tab > **1.0 Prepare for Submission**.
1. Scroll to **Build** > **+** > select the TestFlight build from A-8.
2. Top right > **Add for Review** > **Submit to App Review**.
3. Status changes to **Waiting for Review**.
4. **Review time:** typically **24 hours to 7 days**. Median is around 24–48h. Watch the email inbox tied to the Apple ID.

---

## Part B — Android / Google Play (60–90 min of work, plus 14-day testing wait)

### B-1. Create the Play Console app entry

1. Sign in to **https://play.google.com/console**.
2. **All apps** > **Create app** (top right).
3. Fill in:
   - App name: `Ick: Food Scanner & Score`
   - Default language: **English – en-US**
   - App or game: **App**
   - Free or paid: **Free**
   - Tick both declarations (Developer Program Policies, US export laws).
4. **Create app.**

### B-2. Dashboard tasks — work top to bottom

Play presents a dashboard checklist. Click each item and fill from `STORE-SUBMISSION.md`.

1. **App access** — does any part require login? Answer **All functionality is available without restrictions** if scanning works without an account. Otherwise provide the demo credentials from §1.10.
2. **Ads** — **No** (§2.7).
3. **Content rating** — launch IARC questionnaire, answer per §2.5. Save and apply rating.
4. **Target audience and content** — pick **13+**, declare **does not appeal to children** (§2.6).
5. **News app** — **No** (§2.9).
6. **COVID-19 contact tracing** — **No** (§2.9).
7. **Data safety** — fill out per §2.4. This takes 15–20 min — go slow, mistakes here are the #1 rejection reason.
8. **Government app** — **No** (§2.9).
9. **Financial features** — **No** (§2.9).
10. **Health features** — declare **informational nutrition guidance, not a medical device** (§2.9).

### B-3. ⚠️ Set up closed testing (the 20-tester / 14-day requirement)

**This applies to all first-time production releases from new personal developer accounts. Plan two weeks ahead.**

1. Path: **Testing > Closed testing**.
2. **Create track** > name it `Closed Test – Launch`.
3. **Testers** tab > **Create email list** > paste 20+ tester emails (any Gmail accounts work).
4. **Countries / regions** > select the regions you want to launch in eventually.
5. Upload your AAB to this track (Step B-7).
6. Each tester must **install the app** and **open it at least once** within the 14-day window. Send them the opt-in link Play generates.
7. After **14 continuous days with 20+ active testers**, the "Promote to production" button unlocks.

Skip if you're on an organization account.

### B-4. Main store listing

Path: **Grow > Store presence > Main store listing**.

Copy from `STORE-SUBMISSION.md` §2.1, §2.2, §2.3:
- App name, short description, full description
- App icon: upload `frontend/public/icons/icon-512.png` (Play wants 512×512)
- Feature graphic: 1024×500 — you'll need to design one (gradient background, app logo, tagline "Scan it. Ick it. Swap it.")
- Phone screenshots: 4–8 from `frontend/assets/screenshots/android/phone/`
- 7-inch tablet screenshots: 1–8 from `frontend/assets/screenshots/android/tablet7/`
- App category: **Health & Fitness** (§2.3)
- Tags: pick up to 5 (§2.3)
- Email: `hello@ickthatish.com`
- Website: `https://ickthatish.com`
- Privacy policy: `https://ickthatish.com/privacy-policy`

### B-5. Set up the service account for Codemagic (recommended)

1. **Setup > API access** in Play Console.
2. Click **Create new service account** > opens Google Cloud Console in a new tab.
3. In Google Cloud: **IAM & Admin > Service Accounts > Create Service Account**.
   - Name: `codemagic-play-publisher`
   - Role: skip role assignment in GCP (Play handles it).
   - Done > select the account > **Keys** tab > **Add Key > Create new key > JSON** > download.
4. Back in Play Console: refresh API access, find the new account, **Grant access**.
   - App permissions: only the **Ick** app.
   - Account permissions: **Release manager** (release apps to testing/production, manage testing tracks).
   - **Invite user**.
5. In **Codemagic > Teams > Integrations > Google Play**, upload the JSON key, copy the variable name into `codemagic.yaml` (typically `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`).

**Or skip this for the first release** and upload the AAB manually (Step B-6).

### B-6. Build the signed AAB via Codemagic

1. Make sure the **Android workflow** in `codemagic.yaml` produces a signed AAB (it does).
2. Push to `main` or trigger manually.
3. Wait ~10–20 min.
4. Download the AAB artifact from the Codemagic build page.

### B-7. Upload the AAB to the closed-testing track

Path: **Testing > Closed testing > your track > Create new release**.
1. Drag in the `.aab` file from B-6.
2. Add release notes (use §2.1 / §1.6 wording).
3. **Save > Review release > Start rollout to Closed testing**.
4. Wait for processing. Once it's live, send testers their opt-in link.

### B-8. (After 14 days) Promote to Production

1. Path: **Production > Create new release**.
2. Promote the same AAB from the closed track.
3. Confirm all dashboard items are green (no red banners).
4. **Review release > Start rollout to Production**.
5. **Review time:** typically **a few hours to 7 days** on a new account; subsequent releases are usually <24h.

---

## Part C — Final Sanity Checks (do these before tapping Submit)

- [ ] App launches on a fresh install with no crashes (run from TestFlight + closed test, not local dev build).
- [ ] Camera permission prompt fires correctly on first scan.
- [ ] Push notifications register a token (check backend logs after install).
- [ ] Privacy policy URL returns 200 in an incognito browser.
- [ ] Support URL returns 200 in an incognito browser.
- [ ] Demo reviewer account in §1.10 / §1.11 actually logs in.
- [ ] Premium subscription flow opens, completes a Stripe test charge, and unlocks premium state in the app.
- [ ] Delete Account at Profile > Delete Account actually deletes (matches Play Data Safety claim).
- [ ] App version number in `package.json` / native config matches what's shown in stores.
- [ ] No debug/staging URLs left in the binary (grep `localhost`, `192.168`, `ngrok`).

---

## Part D — After Submission

- **Apple decisions** arrive by email and in App Store Connect > Notifications. If rejected, read the resolution center message, fix, and resubmit (review clock resets but is usually faster on the second pass).
- **Play decisions** arrive by email and in Play Console > Inbox. Common gotchas: Data Safety mismatch with privacy policy, missing target audience declaration, screenshots that show iOS UI on an Android listing.
- **Once both are live**, update `MEMORY.md` / project README with the live store URLs and tag the release in git.

Good luck, ship it. 🚀
