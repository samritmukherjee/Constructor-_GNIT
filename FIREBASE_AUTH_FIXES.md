# Firebase Authentication & Firestore Fixes

## Issues Fixed

### 1. **Authentication State Not Ready**
**Problem:** Users couldn't upload products or use features because `auth.currentUser` was `null` even when they were signed in.

**Root Cause:** Firebase authentication state wasn't fully initialized from AsyncStorage before components tried to access `auth.currentUser`. This created a race condition where the app checked for authentication before Firebase had restored the session.

**Solution:** 
- Added `authReady` state to all screens that depend on authentication
- Added `onAuthStateChanged` listeners that wait for auth to initialize
- Only load data after auth state is confirmed
- Added comprehensive logging to track auth state changes

### 2. **Chat and Location Sharing Not Working**
**Problem:** Buyers and farmers couldn't send messages or share locations in chat.

**Root Cause:** Same auth initialization issue - chat operations were attempted before auth was ready.

**Solution:**
- Added `authReady` state to ChatScreen
- Wait for auth initialization before creating chat threads
- Improved error messages to guide users to log out/in if auth fails
- Added detailed logging to track chat operations

### 3. **Missing Error Feedback**
**Problem:** Users weren't getting helpful error messages when operations failed.

**Solution:**
- Enhanced all error messages to include troubleshooting steps
- Added console logging throughout auth-dependent operations
- Changed generic "Please sign in" messages to "Please sign in. Try logging out and back in."
- Added Firebase operation logging to track success/failure

## Files Modified

### Screens
1. **ContactBuyerScreen.tsx**
   - Added `authReady` state
   - Modified `useEffect` to wait for auth initialization
   - Improved error handling in `loadProducts`, `loadMarketDeals`, `handleUploadProduct`
   - Added logging for all auth-dependent operations

2. **ContactFarmerScreen.tsx**
   - Added `authReady` state
   - Modified `useEffect` to wait for auth initialization
   - Improved error handling in `loadBuyerDeals`, `loadHiredFarmers`, `submitNegotiation`, `handleRequestToBuy`
   - Added logging for all auth-dependent operations

3. **ChatScreen.tsx**
   - Added `authReady` state
   - Wait for auth before initializing chat threads
   - Enhanced error messages for chat operations
   - Added logging for message sending and location sharing

### Services
1. **firebase.ts**
   - Added global `onAuthStateChanged` listener for debugging
   - Logs all auth state changes with user ID
   - Helps identify when users are signed in/out

2. **chat.ts**
   - Improved error messages in `getOrCreateChatThread`
   - Enhanced logging in `sendChatMessage`
   - Better error details in `sendChatLocationMessage`
   - Changed generic error messages to include actual error details

## How Auth Initialization Works Now

```typescript
// 1. Component mounts with authReady = false
const [authReady, setAuthReady] = useState(false);

// 2. Listen for auth state changes
useEffect(() => {
  const unsub = auth.onAuthStateChanged((user) => {
    console.log('Auth state changed:', user ? `User ${user.uid}` : 'No user');
    setAuthReady(true); // Auth is now ready (signed in or confirmed signed out)
    if (user) {
      // User is signed in - load data
      loadProducts();
      loadMarketDeals();
    } else {
      // User is signed out - clear data
      setUploadedProducts([]);
      setMarketDeals([]);
    }
  });
  return unsub;
}, []);

// 3. All operations check for auth
const handleOperation = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.error('Operation: No authenticated user');
    showAlert('error', 'Please sign in. Try logging out and back in.');
    return;
  }
  
  console.log('Performing operation for user:', user.uid);
  // ... operation code
};
```

## Testing Checklist

After these fixes, verify:

- [ ] **Product Upload**
  - Farmer can upload products
  - Image validation works
  - Products appear in farmer's inventory

- [ ] **Marketplace**
  - Buyer can search for products
  - Buyer can send requests to buy
  - Buyer can negotiate
  - Farmer receives notifications
  - Farmer can accept/reject/counter offers

- [ ] **Chat**
  - Buyer can chat with farmer
  - Farmer can chat with buyer
  - Messages appear for both parties
  - Chat thread persists

- [ ] **Location Sharing**
  - Users can share location in chat
  - Location appears as a clickable link
  - Clicking opens Google Maps

## Debugging

### Check Console Logs

Look for these log patterns:

**Auth Initialization:**
```
✅ Firebase Auth initialized with AsyncStorage persistence
🔐 Auth State: User signed in - <uid> <email>
```

**Screen Loading:**
```
Auth state changed: User <uid>
Loading products for user: <uid>
Loading market deals for user: <uid>
```

**Operations:**
```
Uploading product for user: <uid> <email>
Sending message as user: <uid>
Sharing location as user: <uid>
```

### Common Issues

**Issue:** "Please sign in to upload products"
**Solution:** 
1. Check console for auth state logs
2. Try logging out and back in
3. Verify Firebase Auth is enabled in Firebase Console
4. Check that user appears in Firebase Console > Authentication

**Issue:** Chat or location sharing not working
**Solution:**
1. Check console for "No authenticated user" errors
2. Verify Firestore rules allow chat operations
3. Check that buyerId and farmerId are being passed correctly
4. Try restarting the app

**Issue:** Auth state shows user but operations fail
**Solution:**
1. Check Firestore rules in Firebase Console
2. Verify user document exists in `users` collection
3. Check for network connectivity
4. Look for permission errors in console

## Firestore Rules

Ensure these rules are deployed:

```javascript
// Users can read all profiles (needed for phone lookup)
match /users/{userId} {
  allow read: if true;
  allow create, update: if request.auth.uid == userId;
}

// Products accessible to authenticated users
match /products/{productId} {
  allow read: if request.auth != null;
  allow create, update, delete: if request.auth.uid == resource.data.farmerId;
}

// Chats only for participants
match /chats/{chatId} {
  allow read, write: if request.auth != null && 
    (request.auth.uid in resource.data.participantIds ||
     request.auth.uid == resource.data.buyerId ||
     request.auth.uid == resource.data.farmerId);
}
```

## Next Steps

1. **Deploy Updated Code:**
   ```bash
   # Test locally first
   npm start
   
   # Build for production
   eas build --platform android
   eas build --platform ios
   ```

2. **Monitor Logs:**
   - Check console for auth state changes
   - Monitor Firebase Console for user activity
   - Look for Firestore permission errors

3. **User Testing:**
   - Have users test product upload
   - Verify chat functionality
   - Test location sharing
   - Check notifications work

## Support

If issues persist:

1. Check Firebase Console > Authentication to verify user is listed
2. Check Firebase Console > Firestore to verify data is being created
3. Review console logs for specific error messages
4. Ensure Firebase project has all necessary services enabled:
   - Authentication (Email/Password and Phone)
   - Firestore Database
   - Cloud Storage
