# Clipper OS Mobile

Mobile content management app for social media creators and clipper workflows.
Built with Vite + Tailwind CSS + Capacitor for Android and iOS.

## Features

- **Dashboard** — Daily progress, schedule overview, and quick stats
- **Content Library** — Store finished assets with tags, links, and metadata
- **Clip Manager** — Track clips from raw footage → editing → approved
- **Content Pipeline** — 7-day calendar view with scheduling and time slots
- **Publishing History** — Track performance and recycle top content
- **AI Studio** — AI content generation (requires backend proxy, disabled by default)
- **Data Export** — CSV export of publishing history
- **Offline-First** — All data stored in localStorage, no server required

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | HTML, Tailwind CSS v3, Vanilla JS   |
| Build       | Vite 8                              |
| Icons       | FontAwesome (locally bundled)       |
| Mobile      | Capacitor 8 (Android + iOS)         |
| Storage     | localStorage                        |

## App Identity

| Setting     | Value              |
|-------------|---------------------|
| App Name    | Clipper OS          |
| App ID      | `io.clipper.os`     |
| Web Dir     | `dist`              |
| Version     | 1.0.0               |

> **Note:** If you need a custom domain-based ID (e.g., `com.yourcompany.clipperos`), update the ID in:
> - `capacitor.config.json` → `appId`
> - `android/app/build.gradle` → `applicationId` and `namespace`
> - `android/app/src/main/res/values/strings.xml` → `package_name` and `custom_url_scheme`
> - `ios/App/App.xcodeproj/project.pbxproj` → `PRODUCT_BUNDLE_IDENTIFIER` (2 occurrences)

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

# Open iOS project in Xcode (macOS only)
npm run cap:open:ios
```

## Build Android AAB (Release)

1. Build and sync:
   ```bash
   npm run build && npx cap sync
   npx cap open android
   ```
2. In Android Studio: **Build → Generate Signed Bundle / APK**
3. Select **Android App Bundle**
4. Configure keystore (create one if first time)
5. Select **release** build variant
6. AAB output: `android/app/release/app-release.aab`

See [docs/play-store-checklist.md](docs/play-store-checklist.md) for full Play Store guide.

## Archive iOS App (Release)

1. Build and sync:
   ```bash
   npm run build && npx cap sync
   npx cap open ios
   ```
2. In Xcode: set Bundle Identifier, Team, and Signing
3. Select "Any iOS Device" as target
4. **Product → Archive**
5. In Organizer: **Distribute App → App Store Connect**

See [docs/app-store-checklist.md](docs/app-store-checklist.md) for full App Store guide.

## Versioning

| Platform | Version Field                   | Build Field             | File                                  |
|----------|---------------------------------|-------------------------|---------------------------------------|
| Android  | `versionName` (e.g., "1.0.0")  | `versionCode` (integer) | `android/app/build.gradle`            |
| iOS      | `MARKETING_VERSION` (e.g., 1.0) | `CURRENT_PROJECT_VERSION` (integer) | Xcode project settings |

## Gemini AI Integration

The AI feature is **disabled by default** in production for security.

### Development Mode
```bash
# Create .env file
echo "VITE_GEMINI_ENABLED=true" > .env
npm run dev
```

### Production Mode
- AI tab shows a professional "Coming Soon" placeholder
- No API keys are embedded in the production bundle
- No direct calls to external AI APIs from client code

### Adding a Backend Proxy (Future)

To enable AI in production, set up a backend proxy:

1. Create an API endpoint (e.g., `/api/gemini/generate`)
2. Store the Gemini API key server-side only
3. Proxy requests from the client through your backend
4. Update `src/main.js` → `generateWithAI()` to call your endpoint
5. Set `VITE_GEMINI_ENABLED=true` in your production environment

## Privacy

- All data stored on-device in localStorage
- No data transmitted to external servers (unless AI is explicitly enabled with a backend)
- No analytics or tracking SDKs included
- Privacy policy URL required for store submissions (host your own)

## Project Structure

```
├── index.html                  # HTML entry point (Vite)
├── src/
│   ├── main.js                 # Application logic (all views, data, events)
│   └── styles.css              # Tailwind CSS + custom styles
├── public/
│   ├── manifest.webmanifest    # PWA manifest
│   └── icons/                  # App icons (72–512px)
├── resources/
│   ├── icon.svg                # Source icon for native asset generation
│   └── splash.svg              # Source splash screen
├── android/                    # Capacitor Android project
├── ios/                        # Capacitor iOS project
├── docs/
│   ├── play-store-checklist.md
│   ├── app-store-checklist.md
│   └── publish-readiness-audit.md
├── capacitor.config.json       # Capacitor configuration
├── vite.config.js              # Vite build configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── RELEASE_CHECKLIST.md        # Pre-release checklist
└── .env.example                # Environment variables template
```

## NPM Scripts

| Script              | Description                                   |
|---------------------|-----------------------------------------------|
| `dev`               | Start Vite development server on port 3000    |
| `build`             | Build production web assets to `dist/`        |
| `preview`           | Preview production build locally              |
| `build:mobile`      | Build web + sync to native projects           |
| `cap:sync`          | Sync web assets to Android/iOS                |
| `cap:open:android`  | Open Android project in Android Studio        |
| `cap:open:ios`      | Open iOS project in Xcode                     |
