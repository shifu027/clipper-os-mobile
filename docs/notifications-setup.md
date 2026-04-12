# Local Notifications Setup

This guide explains how to set up and test local notifications in Clipper OS Mobile.

## Overview

The app uses `@capacitor/local-notifications` to schedule native device reminders **15 minutes before** each scheduled post. Notifications work on:

- ✅ Android (API 26+)
- ✅ iOS (13+)
- ⚠️ Web browsers — not supported (graceful no-op)

---

## Android Setup

### 1. Sync Capacitor

After installing the plugin, sync the native project:

```bash
npm run build:mobile
```

### 2. Permissions (Android 13+)

On Android 13 and above, the app will automatically prompt the user for the `POST_NOTIFICATIONS` permission when they enable reminders in **Settings → Notifications**.

The permission declaration is handled automatically by the Capacitor plugin in `AndroidManifest.xml`.

### 3. Test on Device

```bash
npx cap open android
# Build and run on a connected device or emulator
```

---

## iOS Setup

### 1. Sync Capacitor

```bash
npm run build:mobile
```

### 2. Configure Notification Entitlements

1. Open the project in Xcode:
   ```bash
   npx cap open ios
   ```
2. Select the `App` target → **Signing & Capabilities**
3. Add **Push Notifications** capability (required even for local notifications on iOS)

### 3. Test on Device

Local notifications **do not work in the iOS Simulator**. You must test on a physical device.

---

## How It Works

1. When the user enables reminders in **Settings → Notifications**, the app requests permission
2. Each time a post is scheduled, a notification is created:
   - **Title:** `⏰ Time to post!`
   - **Body:** `{asset title} — {platform}`
   - **Trigger:** 15 minutes before the scheduled post time
3. When a post is marked as published, deleted, or unscheduled, the notification is automatically cancelled

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Notifications not appearing on iOS | Check Settings app → Notifications → Clipper OS → Allow Notifications |
| Notifications not appearing on Android | Check app notification settings in device Settings |
| Notification shows wrong time | Ensure device timezone matches the scheduled time |
| No permission prompt | User may have already denied — direct them to device Settings |

---

## Web / PWA

Local notifications are **not available in web browsers**. The app gracefully skips scheduling when running in a browser environment. Users will see no error — the feature is silently disabled.

For web push notifications (future feature), a service worker and backend server would be required.
