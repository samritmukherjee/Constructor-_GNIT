# 🔥 Firebase Rules Setup - REQUIRED

## ⚠️ Critical: You must update these rules for the app to work!

The errors you're seeing are because Firebase is blocking all reads/writes by default.

---

## Step 1: Update Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **showcase2k25**
3. Click **Firestore Database** in left menu
4. Click **Rules** tab
5. **Replace ALL existing rules** with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles
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

6. Click **Publish**
7. Wait for "Rules published successfully" message

---

## Step 2: Setup Firebase Storage (for product images)

1. In Firebase Console, click **Storage** in left menu
2. If you see "Get started", click it and choose "Start in test mode", then click "Next" and "Done"
3. Click **Rules** tab
4. **Replace ALL existing rules** with this:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Product images are stored under: products/{farmerId}/{filename}
    match /products/{farmerId}/{allPaths=**} {
      allow read: if true;  // Anyone can read product images
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
6. Wait for "Rules published successfully" message

---

## Step 3: Verify Your .env File

Open your `.env` file and make sure you have:

```bash
# These MUST be set
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key-here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com  # ⚠️ CRITICAL for Storage!
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

**Important**: The `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` is usually `<your-project-id>.appspot.com`

You can find all these values in:
1. Firebase Console → Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Select your Web app
4. Copy the config values

---

## Step 4: Restart Your Development Server

After updating the rules and .env:

```bash
# Stop your current server (Ctrl+C)
# Then restart:
npx expo start --clear
```

---

## ✅ How to Test It's Working

### Test 1: Product Upload (Farmer Side)
1. Sign in as a **Farmer**
2. Go to "Contact Buyer" screen
3. Click "Upload" button
4. Fill in product details and pick an image
5. Click "Upload Product"
6. **Expected**: 
   - See console logs showing upload progress
   - Success alert
   - Product appears in "My Products" section

### Test 2: Product Search + Negotiation (Buyer Side)
1. Sign in as a **Buyer** (different account)
2. Go to "Contact Farmer" screen
3. Fill search form (location, crop type, or quantity)
4. Click "Search Farmers"
5. **Expected**: 
   - See farmers who have uploaded products
  - Can send **Negotiation** or **Request to Buy**

### Test 3: Notifications (Farmer Side)
1. Sign in as a **Farmer**
2. Go to "Contact Buyer" screen
3. **Expected**:
  - See incoming requests under "Incoming Requests"
  - Can **Accept** / **Reject**
  - If accepting a negotiation, product price/quantity updates to negotiated values

---

## 🐛 Troubleshooting

### Still seeing "Missing or insufficient permissions"?
- ✅ Double-check you published BOTH Firestore AND Storage rules
- ✅ Make sure you're signed in (check `auth.currentUser` is not null)
- ✅ Confirm you're editing rules for the SAME Firebase project as your app (`EXPO_PUBLIC_FIREBASE_PROJECT_ID`)
- ✅ If Firebase **App Check** is enabled/enforced for Firestore, you will get permission errors until you configure App Check or disable enforcement for development
- ✅ Clear browser cache or restart Expo dev server
- ✅ Check Firebase Console → Authentication → Users to confirm you're authenticated

### Storage upload still failing?
- ✅ Verify `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` is in `.env`
- ✅ Check Firebase Console → Storage is initialized
- ✅ Check Storage rules are published
- ✅ Look at console logs for detailed error info (we added extra logging)

### Seeing `storage/unknown` with HTTP `404`?
- ✅ This typically means **Firebase Storage is not enabled** yet (no bucket exists) OR the bucket name is wrong.
- ✅ Go to Firebase Console → **Storage** → click **Get started** to create the default bucket.
- ✅ The app also has a fallback: if Storage returns 404, it will **embed the picked image as base64 in Firestore** so the upload can still work for demos.
  - If you get an "image too large" error, pick a smaller image or lower image quality.
  - For production, enable Storage instead of relying on base64 embedding.

### "Failed to fetch products" on load?
- This is now handled gracefully - it just shows "No products uploaded yet"
- Only shows error if there's a real problem (not just empty state)

---

## 📊 What Each Rule Does

### Firestore Rules:
- **`/products`**: Any authenticated user can read (buyers browse), only owner farmer can write
- **`/hiredFarmers`**: Only the buyer who hired can see their hired farmers list
- **`/marketDeals`**: Buyer creates, farmer accepts/rejects, buyer reads updates
- **`/users`**: Users can only read/write their own profile

### Storage Rules:
- **`/products/{farmerId}/`**: Anyone can view images, only that farmer can upload to their folder

---

## 🎯 Quick Checklist

- [ ] Published Firestore rules (copy-pasted exactly)
- [ ] Published Storage rules (copy-pasted exactly)  
- [ ] Verified `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env`
- [ ] Restarted Expo dev server with `--clear`
- [ ] Signed in as a user
- [ ] Tested product upload

Once all checked, the errors should disappear! 🚀
