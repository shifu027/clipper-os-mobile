# Clipper OS Mobile

Content management app for social media workflow, built as a mobile app for Android and iOS using Vite and Capacitor.

## Tech Stack

- **Frontend**: HTML, CSS (Tailwind CSS v3), Vanilla JS
- **Build Tool**: Vite
- **Icons**: FontAwesome (locally bundled)
- **Mobile**: Capacitor (Android + iOS)
- **Storage**: localStorage

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Mobile Development

### Build for Mobile

```bash
# Build web assets and sync to native projects
npm run build:mobile

# Or step by step:
npm run build
npm run cap:sync
```

### Open Native Projects

```bash
# Open Android project in Android Studio
npm run cap:open:android

# Open iOS project in Xcode (requires macOS)
npm run cap:open:ios
```

### Local Run Steps

1. Install dependencies: `npm install`
2. Build the web app: `npm run build`
3. Sync to native projects: `npx cap sync`
4. Open in IDE:
   - Android: `npx cap open android` → Run in Android Studio
   - iOS: `npx cap open ios` → Run in Xcode

## Build Android AAB

1. Build and sync:
   ```bash
   npm run build
   npx cap sync
   npx cap open android
   ```
2. In Android Studio: **Build > Generate Signed Bundle / APK**
3. Select **Android App Bundle**
4. Configure keystore (create one if first time)
5. Select **release** build variant
6. AAB will be at `android/app/release/app-release.aab`

See [docs/play-store-checklist.md](docs/play-store-checklist.md) for full Play Store submission guide.

## Archive iOS App in Xcode

1. Build and sync:
   ```bash
   npm run build
   npx cap sync
   npx cap open ios
   ```
2. In Xcode: Set Bundle Identifier, Team, and Signing
3. Select "Any iOS Device" as target
4. **Product > Archive**
5. In Organizer: **Distribute App > App Store Connect**

See [docs/app-store-checklist.md](docs/app-store-checklist.md) for full App Store submission guide.

## Versioning

### Android
- `versionCode`: Integer, must increment with each Play Store upload
- `versionName`: Semantic version (e.g., "1.0.0")
- Edit in: `android/app/build.gradle`

### iOS
- `CFBundleVersion`: Build number, must increment per upload
- `CFBundleShortVersionString`: Semantic version (e.g., "1.0.0")
- Edit in: Xcode project settings

## Gemini AI Integration

The Gemini AI feature is **disabled by default** in production builds for security.

To enable the Gemini tab during development:
```bash
# Create .env file
VITE_GEMINI_ENABLED=true
```

**Important**: The Gemini integration requires a backend proxy server to call the Gemini API. API keys must never be embedded in client-side code. When the feature is enabled, the app expects a backend endpoint (e.g., `/api/gemini/generate`) to handle API communication securely.

### Release-Mode Behavior
- Gemini tab shows a placeholder message explaining the feature is unavailable
- No API keys are embedded in the production bundle
- No direct calls to external AI APIs from client code

## Project Structure

```
├── index.html              # Main HTML entry point
├── src/
│   ├── main.js             # Application logic
│   └── styles.css          # Tailwind CSS + custom styles
├── public/
│   ├── manifest.webmanifest # PWA manifest
│   └── icons/              # App icons (various sizes)
├── resources/
│   ├── icon.svg            # Source icon for generating native assets
│   └── splash.svg          # Source splash screen
├── android/                # Capacitor Android project
├── ios/                    # Capacitor iOS project
├── docs/
│   ├── play-store-checklist.md
│   └── app-store-checklist.md
├── capacitor.config.json   # Capacitor configuration
├── vite.config.js          # Vite build configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
└── RELEASE_CHECKLIST.md    # Pre-release checklist
```

## App Configuration

| Setting | Value |
|---------|-------|
| App Name | Clipper OS |
| App ID | com.seudominio.clipperos |
| Web Dir | dist |
| Version | 1.0.0 |

## Privacy Policy

A privacy policy URL is required for both Google Play and App Store submissions. Add your privacy policy URL to the store listings before submission. The app currently stores data only in the device's localStorage and does not transmit user data to external servers (unless Gemini AI is explicitly enabled).

## NPM Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start Vite development server |
| `build` | Build production web assets to `dist/` |
| `preview` | Preview production build locally |
| `build:mobile` | Build web + sync to native projects |
| `cap:sync` | Sync web assets to Android/iOS |
| `cap:open:android` | Open Android project in Android Studio |
| `cap:open:ios` | Open iOS project in Xcode |

