/**
 * SyncManager — Firebase Firestore cloud sync
 * Runs in offline-only mode when Firebase env vars are not configured.
 */

export const SyncManager = {
  app: null,
  db: null,
  auth: null,
  userId: null,
  unsubscribe: null,
  enabled: false,

  async init() {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) {
      console.log('[SyncManager] Firebase not configured. Running in offline mode.');
      return false;
    }

    try {
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, enableIndexedDbPersistence } = await import('firebase/firestore');
      const { getAuth, signInAnonymously, onAuthStateChanged } = await import('firebase/auth');

      const firebaseConfig = {
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      };

      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Enable offline persistence
      try {
        await enableIndexedDbPersistence(this.db);
      } catch (err) {
        if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
          console.warn('[SyncManager] Persistence error:', err);
        }
      }

      // Sign in anonymously and wait for auth
      await new Promise((resolve) => {
        const unsub = onAuthStateChanged(this.auth, async (user) => {
          unsub();
          if (user) {
            this.userId = user.uid;
          } else {
            try {
              const cred = await signInAnonymously(this.auth);
              this.userId = cred.user.uid;
            } catch (e) {
              console.warn('[SyncManager] Anonymous sign-in failed:', e);
            }
          }
          resolve();
        });
      });

      this.enabled = !!this.userId;
      return this.enabled;
    } catch (e) {
      console.warn('[SyncManager] init failed:', e);
      return false;
    }
  },

  async save(state) {
    if (!this.enabled || !this.userId) return;
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const ref = doc(this.db, 'users', this.userId, 'data', 'appState');
      // Exclude non-serialisable / transient fields
      const { ...serializable } = state;
      await setDoc(ref, { ...serializable, _updatedAt: Date.now() });
    } catch (e) {
      console.warn('[SyncManager] save error:', e);
    }
  },

  async load() {
    if (!this.enabled || !this.userId) return null;
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const ref = doc(this.db, 'users', this.userId, 'data', 'appState');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        delete data._updatedAt;
        return data;
      }
    } catch (e) {
      console.warn('[SyncManager] load error:', e);
    }
    return null;
  },

  subscribe(onUpdate) {
    if (!this.enabled || !this.userId) return;
    // Defer import so subscribe can be called synchronously after init
    import('firebase/firestore').then(({ doc, onSnapshot }) => {
      const ref = doc(this.db, 'users', this.userId, 'data', 'appState');
      this.unsubscribe = onSnapshot(ref, (snap) => {
        if (snap.exists() && snap.metadata.hasPendingWrites === false) {
          const data = snap.data();
          delete data._updatedAt;
          onUpdate(data);
        }
      }, (e) => {
        console.warn('[SyncManager] snapshot error:', e);
      });
    });
  },

  disconnect() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  },
};
