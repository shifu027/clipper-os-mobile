# App Store Connect Submission Checklist

## Prerequisites

- [ ] Apple Developer Program membership ($99/year)
- [ ] Xcode installed on macOS
- [ ] Valid Apple Development and Distribution certificates
- [ ] App ID registered in Apple Developer portal
- [ ] Provisioning profiles created (Development + Distribution)

## Build & Archive

1. Build the web assets:
   ```bash
   npm run build
   npx cap sync
   ```

2. Open Xcode:
   ```bash
   npx cap open ios
   ```

3. In Xcode, configure:
   - [ ] **Bundle Identifier**: `com.seudominio.clipperos`
   - [ ] **Team**: Select your Apple Developer team
   - [ ] **Signing**: Automatic or Manual
   - [ ] **Version**: 1.0.0 (CFBundleShortVersionString)
   - [ ] **Build Number**: 1 (CFBundleVersion)
   - [ ] **Deployment Target**: iOS 16.0 or later

4. Archive the app:
   - Select a physical device or "Any iOS Device" as build target
   - Go to **Product > Archive**
   - Wait for archive to complete

5. Upload to App Store Connect:
   - In the Organizer window, select the archive
   - Click **Distribute App**
   - Select **App Store Connect**
   - Follow the upload wizard
   - Wait for processing (can take 15-30 minutes)

## Versioning

- **CFBundleShortVersionString** (Version): Semantic version shown to users (e.g., "1.0.0")
- **CFBundleVersion** (Build): Must increment for each upload within a version
- Location: `ios/App/App/Info.plist` or Xcode project settings

## Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps > +** (Add New App)
3. Fill in:
   - [ ] **Platform**: iOS
   - [ ] **Name**: Clipper OS
   - [ ] **Primary Language**: Portuguese (Brazil) or English
   - [ ] **Bundle ID**: com.seudominio.clipperos
   - [ ] **SKU**: clipper-os-mobile (unique identifier)

## App Information

- [ ] **App name**: Clipper OS
- [ ] **Subtitle** (optional, max 30 chars)
- [ ] **Category**: Productivity or Social Networking
- [ ] **Secondary category** (optional)
- [ ] **Content rights**: Confirm you own the content
- [ ] **Age rating**: Complete the questionnaire

## App Store Listing

- [ ] **Description**: Full app description
- [ ] **Keywords**: Up to 100 characters, comma-separated
- [ ] **Support URL**: Link to support page or contact
- [ ] **Marketing URL** (optional)
- [ ] **Privacy Policy URL**: Required for all apps

## Screenshots

Required for each device size:
- [ ] **iPhone 6.7"** (1290 × 2796): iPhone 15 Pro Max
- [ ] **iPhone 6.5"** (1284 × 2778): iPhone 11 Pro Max
- [ ] **iPhone 5.5"** (1242 × 2208): iPhone 8 Plus
- [ ] **iPad Pro 12.9"** (2048 × 2732): If supporting iPad

Minimum 1 screenshot per size, recommended 3-5.

## App Privacy

Required since December 2020:
- [ ] Complete **App Privacy** details in App Store Connect
- [ ] Declare data types collected:
  - This app uses on-device localStorage only (v1)
  - No data sent to servers (unless Gemini AI is enabled)
- [ ] Link privacy policy URL

## Review Information

- [ ] **Contact info**: Name, phone, email for App Review team
- [ ] **Demo account** (if needed): Not required for Clipper OS
- [ ] **Notes for reviewer** (optional): Explain app functionality

## Submit for Review

1. In App Store Connect, go to your app
2. Select the build uploaded from Xcode
3. Fill in all required information
4. Click **Add for Review**
5. Click **Submit to App Review**

## TestFlight (Recommended First)

Before production release:
1. The uploaded build is automatically available in TestFlight
2. Add internal testers (up to 100, no review needed)
3. Add external testers (up to 10,000, requires beta review)
4. Collect feedback before production release

## Post-Submission

- [ ] Wait for App Review (typically 24-48 hours)
- [ ] Monitor for rejection notices
- [ ] If rejected, address issues and resubmit
- [ ] Check crash reports in Xcode Organizer
- [ ] Monitor App Store ratings and reviews
- [ ] Note: Starting April 28, 2026, submissions require updated minimum SDK versions
