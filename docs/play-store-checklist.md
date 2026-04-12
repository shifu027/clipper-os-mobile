# Google Play Store Submission Checklist

## Prerequisites

- [ ] Google Play Developer account created ($25 one-time fee)
- [ ] Android release keystore created and securely stored
- [ ] App signed with release keystore

## Generate Signed AAB

1. Build the web assets:
   ```bash
   npm run build
   npx cap sync
   ```

2. Open Android Studio:
   ```bash
   npx cap open android
   ```

3. In Android Studio:
   - Go to **Build > Generate Signed Bundle / APK**
   - Select **Android App Bundle**
   - Choose or create a keystore:
     - Keystore path
     - Keystore password
     - Key alias
     - Key password
   - Select **release** build variant
   - Click **Finish**

4. The AAB file will be generated at:
   `android/app/release/app-release.aab`

## Versioning

Before each upload, update in `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        versionCode 1      // Must increment for each upload
        versionName "1.0.0" // User-visible version
    }
}
```

## Create App in Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Home > Create app**
3. Fill in:
   - [ ] App name: "Clipper OS"
   - [ ] Default language
   - [ ] App or Game: App
   - [ ] Free or Paid: Free
   - [ ] Developer contact email
   - [ ] Accept declarations

## Store Listing

- [ ] **Title**: Clipper OS (max 30 chars)
- [ ] **Short description**: Content management for social media workflow (max 80 chars)
- [ ] **Full description**: Detailed app description (max 4000 chars)
- [ ] **App icon**: 512 x 512 PNG (32-bit, no alpha)
- [ ] **Feature graphic**: 1024 x 500 PNG or JPEG
- [ ] **Screenshots**: At least 2 phone screenshots (16:9)
- [ ] **App category**: Productivity or Social
- [ ] **Contact email**
- [ ] **Privacy policy URL**

## Content Rating

- [ ] Complete the content rating questionnaire in Play Console
- [ ] App will receive a rating based on answers (e.g., PEGI, ESRB)

## Data Safety

- [ ] Complete the Data Safety form
- [ ] Declare data collection practices:
  - This app uses localStorage only (no server-side data collection in v1)
  - If Gemini AI is enabled, document API usage

## Release Track

Choose one:
- [ ] **Internal testing**: Up to 100 testers, no review needed
- [ ] **Closed testing**: Selected group, requires review
- [ ] **Open testing**: Public beta, requires review
- [ ] **Production**: Full public release, requires review

## Upload & Submit

1. Go to **Release > Production** (or chosen track)
2. Click **Create new release**
3. Upload the `.aab` file
4. Add release notes
5. Click **Review release**
6. Click **Start rollout**

## Post-Submission

- [ ] Wait for Google review (typically 1-3 days for new apps)
- [ ] Monitor for rejection emails
- [ ] Check crash reports in Play Console
- [ ] Respond to user reviews
