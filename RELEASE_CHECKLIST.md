# Release Checklist — Clipper OS Mobile

## App Identity

- **Package Name (Android):** `com.seudominio.clipperos`
- **Bundle Identifier (iOS):** `com.seudominio.clipperos`
- **App Name:** Clipper OS
- **Version:** 1.0.0
- **Android versionCode:** 1
- **iOS Build Number:** 1

## Before Release

- [ ] Replace placeholder app icons with final design (use `resources/icon.svg` as base)
- [ ] Replace placeholder splash screens with final design (use `resources/splash.svg` as base)
- [ ] Generate native icons/splash with `npx @capacitor/assets generate`
- [ ] Update `appId` in `capacitor.config.json` with your actual domain
- [ ] Set up release keystore for Android signing
- [ ] Set up iOS signing certificates and provisioning profiles
- [ ] Review and update privacy policy URL
- [ ] Test app on physical Android device
- [ ] Test app on physical iOS device

## Screenshots Needed

### Android (Google Play)
- [ ] Phone screenshots (minimum 2, recommended 8): 16:9 aspect ratio
- [ ] 7-inch tablet screenshots (optional)
- [ ] 10-inch tablet screenshots (optional)
- [ ] Feature graphic: 1024 x 500 px

### iOS (App Store)
- [ ] iPhone 6.7" screenshots (iPhone 15 Pro Max)
- [ ] iPhone 6.5" screenshots (iPhone 11 Pro Max)
- [ ] iPhone 5.5" screenshots (iPhone 8 Plus)
- [ ] iPad Pro 12.9" screenshots (if supporting iPad)

## Store Listing Content

- [ ] App title (max 30 characters for Google Play, 30 for App Store)
- [ ] Short description (max 80 characters for Google Play)
- [ ] Full description (max 4000 characters)
- [ ] Keywords (App Store, up to 100 characters)
- [ ] Category selection
- [ ] Content rating questionnaire completed
- [ ] Contact email address

## Privacy & Legal

- [ ] Privacy policy URL hosted and accessible
- [ ] Terms of service URL (recommended)
- [ ] Data safety form completed (Google Play)
- [ ] App privacy details completed (App Store Connect)
- [ ] No client-side API keys exposed in release build

## Versioning Strategy

### Android
- `versionName`: Semantic versioning (e.g., "1.0.0")
- `versionCode`: Integer that must increase with each upload (e.g., 1, 2, 3...)
- Location: `android/app/build.gradle`

### iOS
- `CFBundleShortVersionString`: Semantic versioning (e.g., "1.0.0")
- `CFBundleVersion`: Build number, must increase per version (e.g., "1", "2")
- Location: Xcode project settings or `ios/App/App/Info.plist`

## Post-Release

- [ ] Monitor crash reports (Firebase Crashlytics or similar)
- [ ] Monitor store reviews
- [ ] Plan next version update
