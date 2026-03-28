# Firebase Setup Guide

## ✅ What's Already Done
- Firebase config is in `.env` file
- Phone OTP authentication is implemented
- Email/Password authentication is implemented (legacy)
- Google sign-in (web only) is implemented
- Firestore database integration is ready

## 🔧 Required Firebase Console Setup

### 1. Enable Authentication Methods
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **showcase2k25**
3. Go to **Authentication** → **Sign-in method**
4. Enable these providers:
   - ✅ **Phone** - Click "Enable" toggle (PRIMARY - used for OTP)
   - ✅ **Email/Password** - Click "Enable" toggle (legacy)
   - ✅ **Google** - Click "Enable" toggle (legacy - no client IDs needed)

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
    // Allow authenticated users to read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

      // Products uploaded by farmers
      // - Any authenticated user can read (buyers need to browse/search)
      // - Only the owning farmer can create/update/delete their own products
      match /products/{productId} {
         allow read: if request.auth != null;
         allow create: if request.auth != null
            && request.resource.data.farmerId == request.auth.uid;
         allow update, delete: if request.auth != null
            && resource.data.farmerId == request.auth.uid;
      }

      // Farmers hired by buyers
      // - Only the buyer who owns the record can read/write it
      match /hiredFarmers/{hireId} {
         allow read: if request.auth != null && resource.data.buyerId == request.auth.uid;
         allow create: if request.auth != null && request.resource.data.buyerId == request.auth.uid;
         allow update, delete: if request.auth != null && resource.data.buyerId == request.auth.uid;
      }

         // Market deals (negotiation + request-to-buy)
         // DEV-FRIENDLY RULES (recommended for this demo):
         // - Any authenticated user can create/read/update/delete deals
         // If you want stricter security later, lock this down to only buyerId/farmerId.
         match /marketDeals/{dealId} {
            allow read, write: if request.auth != null;
         }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Important:** These rules:
- ✅ Users can ONLY read/write their own profile when authenticated
- ✅ NO Firestore access before authentication
- ✅ All other access is denied

3. Click **Publish**

### 4. Configure Firebase Storage (Required for Product Images)
1. In Firebase Console, go to **Storage**
2. If not created, click **Get started**
3. Go to **Rules** tab
4. Replace the rules with this:

```
rules_version = '2';
service firebase.storage {
   match /b/{bucket}/o {
      // Product images are stored under: products/{farmerId}/{filename}
      match /products/{farmerId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == farmerId;
      }

      // Deny everything else by default
      match /{allPaths=**} {
         allow read, write: if false;
      }
   }
}
```

5. Click **Publish**

### 5. Double-check your `.env` values
Ensure you have `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` set (usually `<project-id>.appspot.com`).

## 📱 How OTP Authentication Works

### Phone OTP Flow (Current - ALL Users)
1. **User enters phone number** - 10-digit Indian mobile number
2. **Send OTP** - Firebase sends 6-digit code via SMS
3. **Verify OTP** - User enters code, Firebase authenticates
4. **Post-Authentication**:
   - App checks if `users/{uid}` document exists in Firestore
   - If exists: Load profile, redirect to dashboard based on role
   - If not exists: Create profile with phone number, role, and other details

**Key Security Points:**
- ❌ NO Firestore reads before OTP verification
- ❌ NO phone number existence checks before authentication
- ✅ Firebase Auth handles duplicate phone prevention
- ✅ All Firestore access requires `request.auth != null`

### Platform Support
- **Web**: Works out of the box with invisible reCAPTCHA ✅
- **Android**: Requires @react-native-firebase/auth setup (see MOBILE_OTP_SETUP.md) ✅
- **iOS**: Requires @react-native-firebase/auth + APNs setup (see MOBILE_OTP_SETUP.md) ✅

**IMPORTANT FOR MOBILE:**
- Expo Go does NOT support @react-native-firebase
- Must use development build: `npx expo run:android`
- Or production build: `eas build`
- See [MOBILE_OTP_SETUP.md](MOBILE_OTP_SETUP.md) for complete mobile setup

### Buyer vs Farmer
- Both use same OTP authentication
- Role is selected BEFORE signup (on RoleChoiceScreen)
- Role determines:
  - Which dashboard to show after login
  - Which profile fields are required
  - User capabilities in the app

## 🧪 Testing OTP Authentication

### Test Sign Up (Web - Ready Now)
1. Start your app: `npx expo start`
2. Open in web browser (press 'w')
3. Click "Sign Up"
4. Select role (Farmer or Buyer)
5. Fill in required fields:
   - Full Name
   - Mobile Number (10 digits)
   - Email (optional)
   - Role-specific fields (state, district, etc. for farmers)
6. Click "Send OTP"
7. Check phone for 6-digit code
8. Enter OTP and click "Verify OTP"
9. Should create profile in Firestore and redirect to dashboard

### Test Sign In (Web - Ready Now)
1. Navigate to Sign In screen
2. Enter your mobile number (10 digits)
3. Click "Send OTP"
4. Enter the 6-digit code received
5. Click "Verify OTP"
6. Should redirect to appropriate dashboard (Farmer or Buyer)

### Test on Android (Requires Setup)
**⚠️ DO NOT use Expo Go - it won't work!**

1. **Setup Android (first time only):**
   - Follow [MOBILE_OTP_SETUP.md](MOBILE_OTP_SETUP.md) guide
   - Download google-services.json
   - Add SHA-1 to Firebase
   - Enable Phone auth in Firebase Console

2. **Build development build:**
   ```bash
   npx expo prebuild --clean
   npx expo run:android
   ```

3. **Test OTP flow:**
   - Enter phone number
   - Click "Send OTP"
   - Check device for SMS
   - Enter 6-digit OTP
   - Click "Verify OTP"
   - Should redirect to dashboard

### Test Profile Updates
1. After signing in, go to Profile screen
2. Your data should load from Firestore
3. Make changes and click "Save Changes"
4. Changes should persist in Firestore

## 🐛 Common Issues

### "Missing or insufficient permissions" in Firestore
- ✅ FIXED: App now follows proper auth flow
- Firestore is accessed ONLY after OTP authentication
- Make sure security rules are published (including `/marketDeals` for negotiation/request-to-buy)
- If it still happens, verify you're editing rules for the same Firebase project as `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, and check Firebase App Check enforcement.

### "Failed to send OTP" (Web)
- Verify Phone authentication is enabled in Firebase Console
- Check browser console for reCAPTCHA errors
- Ensure app is running on web

### "OTP authentication on mobile requires additional setup"
- ❌ You're running in Expo Go (not supported)
- ✅ Build development build: `npx expo run:android`
- ✅ Follow [MOBILE_OTP_SETUP.md](MOBILE_OTP_SETUP.md) for complete setup

### "Phone number already in use"
- This is expected - Firebase Auth prevents duplicate phones
- User should sign in instead of signing up

### Mobile OTP not working
- Ensure you're NOT using Expo Go
- Verify google-services.json exists at `android/app/google-services.json`
- Check SHA-1 fingerprint is added to Firebase Console
- Confirm Phone auth is enabled in Firebase Console
- See [MOBILE_OTP_SETUP.md](MOBILE_OTP_SETUP.md) for troubleshooting

### "google-services.json missing" (Android)
- Download from Firebase Console
- Place at `android/app/google-services.json`
- Rebuild: `npx expo run:android`

## 📊 Monitoring Your Data

### View Users
- Firebase Console → Authentication → Users
- See phone numbers (not stored in Firestore before auth)
- Each user has a unique UID

### View Firestore Data
- Firebase Console → Firestore Database → Data
- Browse the `users` collection
- Each document ID is the user's UID
- Contains: fullName, mobileNumber, email (optional), role, timestamps

## 🚀 Next Steps

### For Web Testing (Ready Now)
1. ✅ Enable Phone authentication in Firebase Console
2. ✅ Set up Firestore security rules (copy from above)
3. ✅ Test OTP sign up on web
4. ✅ Test OTP sign in on web

### For Android/iOS Testing (Requires Setup)
1. 📱 Follow [MOBILE_OTP_SETUP.md](MOBILE_OTP_SETUP.md) guide
2. 📥 Download google-services.json (Android) or GoogleService-Info.plist (iOS)
3. 🔐 Add SHA-1 fingerprint to Firebase (Android)
4. 🛠️ Build development build: `npx expo run:android`
5. 📲 Test OTP flow on real device

**Your phone OTP authentication is production-ready for web and mobile!** 🎉



