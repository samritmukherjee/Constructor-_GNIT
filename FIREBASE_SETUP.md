# Firebase Setup Guide

## ✅ What's Already Done
- Firebase config is in `.env` file
- Email/Password authentication is implemented
- Google sign-in (web only) is implemented
- Firestore database integration is ready

## 🔧 Required Firebase Console Setup

### 1. Enable Authentication Methods
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **showcase2k25**
3. Go to **Authentication** → **Sign-in method**
4. Enable these providers:
   - ✅ **Email/Password** - Click "Enable" toggle
   - ✅ **Google** - Click "Enable" toggle (no client IDs needed, Firebase handles it)

### 2. Setup Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. If not created, click **Create database**
3. Choose **Start in test mode** (we'll secure it next)
4. Select a location (closest to your users)

### 3. Configure Firestore Security Rules
1. Go to **Firestore Database** → **Rules** tab
2. Replace the rules with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **Publish**

## 📱 How Authentication Works Now

### Email/Password (All Platforms)
- Works on Android, iOS, and Web
- Users can sign up and sign in with email/password
- Profile data saved to Firestore at `users/{uid}`

### Google Sign-In (Web Only)
- Available only when running on web platform
- Uses Firebase's built-in Google popup authentication
- On mobile, users will see a message to use email/password instead
- No additional OAuth client IDs needed

## 🧪 Testing Your App

### Test Email/Password Authentication
1. Start your app: `npx expo start`
2. Go to Sign Up screen
3. Fill in all fields including email and password
4. Click "Create Account"
5. Should redirect to Dashboard
6. Profile data should be in Firestore

### Test Profile Updates
1. After signing in, go to Profile screen
2. Your data should load from Firestore
3. Make changes and click "Save Changes"
4. Changes should persist in Firestore

### Test Logout
1. In Profile screen, click "Logout"
2. Should sign out from Firebase
3. Should redirect to Sign In screen

## 🐛 Common Issues

### "Permission Denied" errors in Firestore
- Make sure you've set up the security rules above
- Verify the user is signed in (check Firebase Auth in console)

### Google Sign-In not working on mobile
- This is expected! Google sign-in only works on web
- Users should use email/password on mobile apps

### Auth state not persisting
- The app now uses AsyncStorage for persistence
- Sessions should persist across app restarts

## 📊 Monitoring Your Data

### View Users
- Firebase Console → Authentication → Users
- See all registered users

### View Firestore Data
- Firebase Console → Firestore Database → Data
- Browse the `users` collection
- Each document ID is the user's UID

## 🚀 Next Steps

1. Enable Email/Password and Google in Firebase Console
2. Set up Firestore security rules
3. Test sign up with email/password
4. Test profile updates
5. Your authentication is ready to use!
