# Google Play Store Submission Checklist

## Prerequisites

- [ ] Google Play Developer account ($25 one-time fee)
- [ ] Release keystore created and securely stored
- [ ] App tested on physical Android device

## Step 1: Generate Signed AAB

```bash
# Build web assets and sync
npm run build && npx cap sync

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. **Build → Generate Signed Bundle / APK**
2. Select **Android App Bundle**
3. Choose or create keystore:
   - First time: create new keystore with `keytool -genkey -v -keystore clipper-os-release.keystore -alias clipper-os -keyalg RSA -keysize 2048 -validity 10000`
   - Returning: select existing keystore
4. Select **release** build variant
5. Click **Finish**

Output: `android/app/release/app-release.aab`

## Step 2: Versioning

Before each upload, edit `android/app/build.gradle`:

```gradle
defaultConfig {
    applicationId "io.clipper.os"
    versionCode 1      // MUST increment for each upload (1, 2, 3...)
    versionName "1.0.0" // User-visible version
}
```

## Step 3: Create App in Google Play Console

1. Go to [play.google.com/console](https://play.google.com/console)
2. **Home → Create app**
3. Fill in:
   - App name: **Clipper OS**
   - Default language: English (or your preference)
   - App type: **App**
   - Pricing: **Free**
   - Developer contact email
   - Accept declarations

## Step 4: Store Listing

- **Title**: Clipper OS
- **Short description**: Content management for social media creators and workflows
- **Full description**: Write a detailed description of the app's features
- **App icon**: 512 × 512 PNG (32-bit, no alpha)
- **Feature graphic**: 1024 × 500 PNG or JPEG
- **Screenshots**: At least 2 phone screenshots (16:9 ratio)
- **Category**: Productivity
- **Contact email**: your email
- **Privacy policy URL**: your hosted privacy policy

## Step 5: Content Rating

- Complete the content rating questionnaire in Play Console
- Expected rating: Everyone (no violent or mature content)

## Step 6: Data Safety

Complete the Data Safety form:
- **Data collected**: None transmitted to servers
- **Data shared**: None
- **Encryption**: Data stored locally on device only
- **Data deletion**: Users can reset data in app settings

If Gemini AI is enabled in a future version, update to declare API usage.

## Step 7: Release

Recommended release order:
1. **Internal testing** (up to 100 testers, instant)
2. **Closed testing** (selected group, requires review)
3. **Production** (full release, requires review)

To release:
1. Go to **Release → Production** (or chosen track)
2. **Create new release**
3. Upload the `.aab` file
4. Add release notes
5. **Review release → Start rollout**

## Post-Submission

- [ ] Wait for Google review (1-3 days for new apps)
- [ ] Monitor rejection emails
- [ ] Check crash reports in Play Console
- [ ] Respond to user reviews
