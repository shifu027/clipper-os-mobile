# Release Checklist — Clipper OS Mobile

## App Identity

| Field                        | Value           |
|------------------------------|-----------------|
| Package Name (Android)       | `io.clipper.os` |
| Bundle Identifier (iOS)      | `io.clipper.os` |
| App Name                     | Clipper OS      |
| Version                      | 1.0.0           |
| Android versionCode          | 1               |
| iOS Build Number             | 1               |

> To use a custom domain-based ID, update the values listed in README.md → "App Identity" section.

## Already Done ✅

- [x] App ID replaced from placeholder to `io.clipper.os` in all config files
- [x] Android and iOS identifiers are consistent
- [x] Vite build produces correct output
- [x] App has 6 working sections: Dashboard, Library, Clips, Pipeline, History, AI Studio
- [x] Gemini AI disabled in production, professional placeholder shown
- [x] No API keys embedded in client code
- [x] localStorage persistence with migration support
- [x] CSV export for publishing history
- [x] Mobile-first responsive UI
- [x] PWA manifest configured
- [x] Web app icons in public/icons/

## Before Release — Design Assets

- [ ] Replace placeholder app icons with final design (use `resources/icon.svg` as base)
- [ ] Replace placeholder splash screens with final design (use `resources/splash.svg` as base)
- [ ] Generate native icons/splash:
  ```bash
  npx @capacitor/assets generate --iconBackgroundColor '#1e293b' --splashBackgroundColor '#f8fafc'
  ```

## Before Release — Signing

- [ ] **Android**: Create release keystore
  ```bash
  keytool -genkey -v -keystore clipper-os-release.keystore -alias clipper-os -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] **iOS**: Set up signing certificates and provisioning profiles in Apple Developer Portal

## Before Release — Testing

- [ ] Test app on physical Android device
- [ ] Test app on physical iOS device
- [ ] Verify all 6 sections work correctly
- [ ] Verify data persists across app restarts
- [ ] Verify CSV export works
- [ ] Verify modal open/close works
- [ ] Verify navigation between all sections

## Store Requirements

### Screenshots

**Android (Google Play)**
- [ ] Phone screenshots (min 2, recommended 8): 16:9 aspect ratio
- [ ] Feature graphic: 1024 × 500 px

**iOS (App Store)**
- [ ] iPhone 6.7" screenshots (iPhone 15 Pro Max): 1290 × 2796
- [ ] iPhone 6.5" screenshots (iPhone 11 Pro Max): 1284 × 2778
- [ ] iPhone 5.5" screenshots (iPhone 8 Plus): 1242 × 2208

### Store Listing Content

- [ ] App title: "Clipper OS" (max 30 chars)
- [ ] Short description (max 80 chars): "Content management for social media creators"
- [ ] Full description (max 4000 chars)
- [ ] Keywords (App Store, up to 100 chars)
- [ ] Category: Productivity
- [ ] Content rating questionnaire completed
- [ ] Contact email address

### Privacy & Legal

- [ ] Privacy policy URL hosted and accessible
- [ ] Terms of service URL (recommended)
- [ ] Data safety form completed (Google Play)
- [ ] App privacy details completed (App Store Connect)
- [x] No client-side API keys in release build

## Versioning Strategy

Before each store upload, increment versions:

**Android** — edit `android/app/build.gradle`:
```gradle
versionCode 2        // Must increase for each upload
versionName "1.0.1"  // User-visible version
```

**iOS** — edit in Xcode project settings:
- `CURRENT_PROJECT_VERSION`: increment build number
- `MARKETING_VERSION`: update version string

## Post-Release

- [ ] Monitor crash reports
- [ ] Monitor store reviews
- [ ] Plan next version update
