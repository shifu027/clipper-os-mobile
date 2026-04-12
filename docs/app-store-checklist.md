# App Store Connect Submission Checklist

## Prerequisites

- [ ] Apple Developer Program membership ($99/year)
- [ ] Xcode installed on macOS
- [ ] Valid Apple Development and Distribution certificates
- [ ] App ID registered in Apple Developer portal with bundle ID `io.clipper.os`
- [ ] Provisioning profiles created (Development + Distribution)

## Step 1: Build & Archive

```bash
# Build web assets and sync
npm run build && npx cap sync

# Open in Xcode
npx cap open ios
```

In Xcode:
1. Set **Bundle Identifier**: `io.clipper.os`
2. Set **Team**: your Apple Developer team
3. Set **Signing**: Automatic (recommended)
4. Set **Deployment Target**: iOS 16.0 or later
5. Verify **Version**: 1.0.0 and **Build**: 1
6. Select "Any iOS Device" as build target
7. **Product → Archive**
8. In Organizer: **Distribute App → App Store Connect**

## Step 2: Versioning

In Xcode project settings:
- `MARKETING_VERSION`: Semantic version shown to users (e.g., 1.0.0)
- `CURRENT_PROJECT_VERSION`: Build number, must increment per upload (1, 2, 3...)

## Step 3: Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **My Apps → + → New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Clipper OS
   - **Primary Language**: English
   - **Bundle ID**: `io.clipper.os`
   - **SKU**: `clipper-os-mobile`

## Step 4: App Information

- **Category**: Productivity
- **Content rights**: Confirm ownership
- **Age rating**: Complete questionnaire (expected: 4+)

## Step 5: App Store Listing

- **Description**: Full app description
- **Keywords**: content,social media,clips,creator,scheduling,pipeline (up to 100 chars)
- **Support URL**: link to support page or contact
- **Privacy Policy URL**: your hosted privacy policy

## Step 6: Screenshots

Required for each device size (minimum 1, recommended 3-5):
- **iPhone 6.7"** (1290 × 2796): iPhone 15 Pro Max
- **iPhone 6.5"** (1284 × 2778): iPhone 11 Pro Max
- **iPhone 5.5"** (1242 × 2208): iPhone 8 Plus
- **iPad Pro 12.9"** (2048 × 2732): only if supporting iPad

## Step 7: App Privacy

Required since December 2020:
- Declare **data types collected**: None transmitted to servers
- Data stored: On-device localStorage only
- No tracking or analytics SDKs
- Link privacy policy URL

## Step 8: Submit for Review

1. Select the uploaded build
2. Fill in all required fields
3. Add **Notes for reviewer**: "This app manages content locally on the device. No account login is required. All data is stored in localStorage."
4. **Add for Review → Submit to App Review**

## TestFlight (Recommended First)

Before production release:
1. Uploaded build is automatically available in TestFlight
2. Add internal testers (up to 100, no review needed)
3. Add external testers (up to 10,000, requires beta review)
4. Collect feedback before production release

## Post-Submission

- [ ] Wait for App Review (typically 24-48 hours)
- [ ] Monitor rejection notices
- [ ] If rejected, address issues and resubmit
- [ ] Check crash reports in Xcode Organizer
- [ ] Monitor App Store ratings
