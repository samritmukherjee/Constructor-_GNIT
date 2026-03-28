/**
 * Firebase Configuration Diagnostic
 * Run this to verify your Firebase setup is correct
 */

import { auth, db, storage, resolvedStorageBucket } from './firebase';

export const runFirebaseDiagnostics = async () => {
  console.log('🔍 Running Firebase Diagnostics...\n');

  // Check Auth
  console.log('1️⃣ Checking Firebase Auth...');
  try {
    const user = auth.currentUser;
    if (user) {
      console.log('✅ User authenticated:', user.uid);
      console.log('   Email:', user.email || 'N/A');
      console.log('   Phone:', user.phoneNumber || 'N/A');
      console.log('   Display Name:', user.displayName || 'N/A');
    } else {
      console.log('⚠️  No user currently signed in');
    }
  } catch (error) {
    console.error('❌ Auth error:', error);
  }

  // Check Firestore
  console.log('\n2️⃣ Checking Firestore connection...');
  try {
    console.log('   Firestore app:', db.app.name);
    console.log('✅ Firestore initialized');
  } catch (error) {
    console.error('❌ Firestore error:', error);
  }

  // Check Storage
  console.log('\n3️⃣ Checking Firebase Storage...');
  try {
    console.log('   Config bucket (raw):', storage.app.options.storageBucket);
    console.log('   Bucket in use (resolved):', resolvedStorageBucket);
    if (!resolvedStorageBucket) {
      console.error('❌ CRITICAL: storageBucket is not set!');
      console.log('   Add EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET to your .env file');
    } else {
      console.log('✅ Storage initialized');
    }
  } catch (error) {
    console.error('❌ Storage error:', error);
  }

  // Check Environment Variables
  console.log('\n4️⃣ Checking Environment Variables...');
  const envVars = {
    'EXPO_PUBLIC_FIREBASE_API_KEY': process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID': process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    'EXPO_PUBLIC_FIREBASE_APP_ID': process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  let allEnvVarsSet = true;
  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      console.log(`   ✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${key}: NOT SET`);
      allEnvVarsSet = false;
    }
  });

  if (!allEnvVarsSet) {
    console.log('\n⚠️  Some environment variables are missing!');
    console.log('   Check your .env file');
  }

  console.log('\n📋 Summary:');
  console.log('━'.repeat(50));
  if (auth.currentUser) {
    console.log('✅ User is signed in');
  } else {
    console.log('⚠️  User needs to sign in');
  }
  
  if (resolvedStorageBucket) {
    console.log('✅ Storage bucket configured');
  } else {
    console.log('❌ Storage bucket NOT configured - uploads will fail!');
  }

  if (allEnvVarsSet) {
    console.log('✅ All environment variables set');
  } else {
    console.log('❌ Some environment variables missing');
  }

  console.log('\n📖 Next Steps:');
  if (!auth.currentUser) {
    console.log('   1. Sign in to the app');
  }
  console.log('   2. Update Firebase Console rules (see FIREBASE_RULES_SETUP.md)');
  console.log('   3. Restart your dev server: npx expo start --clear');
  console.log('\n');
};

// You can call this from a screen's useEffect to run diagnostics
// Example: useEffect(() => { runFirebaseDiagnostics(); }, []);
