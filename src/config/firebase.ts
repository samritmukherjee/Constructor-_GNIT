/**
 * Firebase Configuration
 * 
 * This file initializes Firebase using environment variables.
 * All credentials are stored in .env file and accessed via process.env.
 * 
 * For Expo projects, environment variables must be prefixed with EXPO_PUBLIC_
 * to be accessible in the client-side code.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  Auth,
  initializeAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration using environment variables
// These values are read from .env file at build time
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const normalizeStorageBucket = (
  rawBucket: string | undefined,
  projectId: string | undefined
): string | undefined => {
  const trimmed = rawBucket?.trim();

  // If not provided, default to the canonical Firebase Storage bucket.
  if (!trimmed) {
    return projectId ? `${projectId}.appspot.com` : undefined;
  }

  let bucket = trimmed;

  // Accept common paste formats.
  if (bucket.startsWith('gs://')) {
    bucket = bucket.slice('gs://'.length);
  }
  if (bucket.startsWith('https://firebasestorage.googleapis.com/v0/b/')) {
    bucket = bucket.slice('https://firebasestorage.googleapis.com/v0/b/'.length);
    bucket = bucket.split('/')[0];
  }

  // Expo/Firebase newcomers often put `<project>.firebasestorage.app`.
  // The default bucket name used by Firebase Storage API is `<project>.appspot.com`.
  // When the bucket name is wrong, uploads often fail with `storage/unknown` + HTTP 404.
  if (projectId) {
    if (bucket === `${projectId}.firebasestorage.app`) return `${projectId}.appspot.com`;
    if (bucket === `${projectId}.firebasestorage.appspot.com`) return `${projectId}.appspot.com`;
    if (bucket.endsWith('.firebasestorage.app')) return `${projectId}.appspot.com`;
    if (bucket.includes('.firebasestorage.')) return `${projectId}.appspot.com`;
  }

  return bucket;
};

const resolvedStorageBucket = normalizeStorageBucket(
  firebaseConfig.storageBucket,
  firebaseConfig.projectId
);

// Validate that required environment variables are set
const validateConfig = (): void => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingKeys = requiredKeys.filter(
    (key) => !firebaseConfig[key as keyof typeof firebaseConfig]
  );

  if (missingKeys.length > 0) {
    console.warn(
      `⚠️ Missing Firebase configuration keys: ${missingKeys.join(', ')}. ` +
      'Please check your .env file.'
    );
  }

  if (!resolvedStorageBucket) {
    console.warn(
      '⚠️ Firebase Storage bucket is not configured. Image uploads will fail. ' +
      'Set EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET in .env (usually <projectId>.appspot.com).'
    );
  } else if (firebaseConfig.storageBucket?.includes('.firebasestorage.app')) {
    console.warn(
      `⚠️ EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET looks non-standard (${firebaseConfig.storageBucket}). ` +
      `Using ${resolvedStorageBucket} instead.`
    );
  }
};

// Validate configuration on module load
validateConfig();

/**
 * Initialize Firebase App
 * Uses singleton pattern to prevent multiple initializations
 */
let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

/**
 * Firestore Database
 */
const db = getFirestore(app);
const storage = resolvedStorageBucket
  ? getStorage(app, `gs://${resolvedStorageBucket}`)
  : getStorage(app);

/**
 * Initialize Firebase Auth with AsyncStorage persistence
 * This ensures the user session persists across app restarts
 */
let auth: Auth;

try {
  // Try to use React Native persistence with AsyncStorage
  const { getReactNativePersistence: getRNPersistence } = require('firebase/auth');
  
  auth = initializeAuth(app, {
    persistence: getRNPersistence(AsyncStorage),
  });

  console.log('✅ Firebase Auth initialized with AsyncStorage persistence');
  
  // Add a global listener to log auth state changes for debugging
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('🔐 Auth State: User signed in -', user.uid, user.email || user.phoneNumber);
    } else {
      console.log('🔓 Auth State: User signed out');
    }
  });
} catch (error) {
  // Fallback: use default getAuth which also provides persistence in React Native
  console.warn('⚠️ React Native persistence setup encountered an issue. Using default auth.');
  auth = getAuth(app);
  
  // Add listener for fallback auth too
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('🔐 Auth State (fallback): User signed in -', user.uid);
    } else {
      console.log('🔓 Auth State (fallback): User signed out');
    }
  });
}

/**
 * Google Auth Provider
 * Configure for popup-based sign-in
 * Note: For React Native, you'll need additional setup with expo-auth-session
 * or react-native-google-signin for native Google Sign-In
 */
const googleProvider = new GoogleAuthProvider();

// Add additional scopes if needed
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Set custom parameters for Google Sign-In
googleProvider.setCustomParameters({
  prompt: 'select_account', // Always show account selection
});

// Export initialized Firebase instances
export { app, auth, db, storage, googleProvider, resolvedStorageBucket };
export default app;
