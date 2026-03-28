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

/**
 * Initialize Firebase Auth with AsyncStorage persistence
 * This ensures the user session persists across app restarts
 */
let auth: Auth;

try {
  // Try to use React Native persistence with AsyncStorage
  // Import dynamically to handle different Firebase versions
  const { getReactNativePersistence } = require('firebase/auth/react-native');
  
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // Fallback: if getReactNativePersistence is not available, use default getAuth
  console.warn('Using default auth persistence. For session persistence, ensure Firebase SDK supports React Native persistence.');
  auth = getAuth(app);
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
export { app, auth, db, googleProvider };
export default app;
