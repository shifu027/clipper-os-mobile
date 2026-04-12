# Firebase Cloud Sync Setup

This guide explains how to set up Firebase Firestore to enable multi-device sync in Clipper OS Mobile.

## Prerequisites

- A Google account
- A Firebase project (free Spark plan is sufficient)

---

## Step 1 — Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Enter a project name (e.g. `clipper-os`)
4. Disable Google Analytics if not needed
5. Click **Create project**

---

## Step 2 — Enable Firestore Database

1. In the Firebase Console, go to **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode**
4. Select a Firestore location closest to your users
5. Click **Enable**

---

## Step 3 — Enable Anonymous Authentication

1. Go to **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in providers**, select **Anonymous**
4. Toggle it **Enabled**
5. Click **Save**

---

## Step 4 — Configure Firestore Security Rules

1. Go to **Firestore Database → Rules**
2. Replace the existing rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/data/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click **Publish**

---

## Step 5 — Get Your App Credentials

1. In the Firebase Console, go to **Project settings** (⚙️ gear icon)
2. Scroll down to **Your apps**
3. Click **Add app → Web** (`</>` icon)
4. Register the app with a nickname (e.g. `clipper-os-web`)
5. Copy the `firebaseConfig` object — you'll need these values

---

## Step 6 — Add Credentials to `.env`

Create a `.env` file in the project root (copy `.env.example`) and fill in the Firebase values:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=clipper-os.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=clipper-os
VITE_FIREBASE_STORAGE_BUCKET=clipper-os.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## How It Works

- When the app starts, it signs in **anonymously** via Firebase Auth
- Each device gets a unique **User ID**
- Your app state is saved to `users/{userId}/data/appState` in Firestore
- Changes are synced in **real time** across all devices using the same User ID
- If Firebase is not configured, the app works **100% offline** with `localStorage`

## Offline Support

The app uses **IndexedDB persistence**, so your data is available offline even when Firebase is configured. Changes are synced when connectivity is restored.

## Multi-Device Sync

Your **Sync ID** (User ID) is shown in **Settings → Cloud Sync**. To sync between devices:

1. Copy your Sync ID from your primary device
2. *(Future feature)* Paste it on another device to merge data

> **Note:** Currently each device gets its own anonymous ID. Cross-device sync works automatically only when using the same browser session or after linking devices (feature roadmap).

## Security Notes

- The `.env` file is **never committed** to git (it's in `.gitignore`)
- Firebase credentials for web apps are **public by design** — Firestore rules enforce security
- Anonymous auth ensures only the owner of an ID can read/write their data
