/**
 * Authentication Service
 * 
 * This module provides all authentication-related functions using Firebase Auth.
 * Uses Firebase Modular SDK (v9+) with async/await pattern.
 * 
 * Available functions:
 * - signUp: Register new user with email and password
 * - signIn: Login with email and password
 * - signInWithGoogle: Google OAuth authentication
 * - logout: Sign out the current user
 * - getCurrentUser: Get the currently authenticated user
 * - onAuthStateChange: Subscribe to auth state changes
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
  UserCredential,
  AuthError,
  GoogleAuthProvider,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { doc, getDoc, serverTimestamp, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, googleProvider, storage } from '../config/firebase';
import { sendOTP, verifyOTP, formatPhoneNumber } from './twilio';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Standard response format for auth operations
 */
interface AuthResponse {
  success: boolean;
  user: User | null;
  message: string;
  errorCode?: string;
}

export interface UserProfileData {
  fullName?: string;
  mobileNumber?: string;
  phoneNumber?: string;
  email?: string;
  state?: string;
  district?: string;
  preferredLanguage?: string;
  farmerType?: string;
  landSize?: string;
  notificationsEnabled?: boolean;
  profilePhoto?: string | null;
  userType?: 'farmer' | 'buyer';
  role?: 'farmer' | 'buyer';
  companyName?: string;
  businessType?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
  isPhoneVerified?: boolean;
  phoneAuthPassword?: string; // Stored password for phone authentication
  authMethod?: 'phone' | 'email';
}

/**
 * Error messages mapped to Firebase error codes
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Sign Up Errors
  'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
  'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/operation-not-allowed': 'Email/password accounts are not enabled. Please contact support.',

  // Sign In Errors
  'auth/user-not-found': 'No account found with this email. Please sign up first.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password. Please check your credentials.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',

  // Google Sign In Errors
  'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
  'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups and try again.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',

  // Network Errors
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',

  // Default
  'default': 'An unexpected error occurred. Please try again.',
};

/**
 * Get user-friendly error message from Firebase error code
 */
const getErrorMessage = (errorCode: string): string => {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['default'];
};

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * Sign Up with Email and Password
 * 
 * Creates a new user account using email and password.
 * 
 * @param email - User's email address
 * @param password - User's password (min 6 characters recommended)
 * @returns Promise<AuthResponse> - Success status, user object, and message
 * 
 * @example
 * const result = await signUp('user@example.com', 'securePassword123');
 * if (result.success) {
 *   console.log('User created:', result.user);
 * } else {
 *   console.error('Sign up failed:', result.message);
 * }
 */
export const signUp = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  try {
    // Validate inputs
    if (!email || !password) {
      return {
        success: false,
        user: null,
        message: 'Email and password are required.',
        errorCode: 'validation/missing-fields',
      };
    }

    // Create user with Firebase Auth
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    // Create a minimal profile document (merge-safe)
    try {
      await setDoc(
        doc(db, 'users', userCredential.user.uid),
        {
          email: userCredential.user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (dbError) {
      // Auth succeeded; don't fail sign-up due to Firestore rules/config.
      console.warn('Profile Firestore write failed:', dbError);
    }

    return {
      success: true,
      user: userCredential.user,
      message: 'Account created successfully!',
    };
  } catch (error) {
    const authError = error as AuthError;
    console.error('Sign up error:', authError.code, authError.message);

    return {
      success: false,
      user: null,
      message: getErrorMessage(authError.code),
      errorCode: authError.code,
    };
  }
};

/**
 * Sign In with Email and Password
 * 
 * Authenticates an existing user using email and password.
 * 
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise<AuthResponse> - Success status, user object, and message
 * 
 * @example
 * const result = await signIn('user@example.com', 'password123');
 * if (result.success) {
 *   console.log('Logged in as:', result.user?.email);
 * }
 */
export const signIn = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  try {
    // Validate inputs
    if (!email || !password) {
      return {
        success: false,
        user: null,
        message: 'Email and password are required.',
        errorCode: 'validation/missing-fields',
      };
    }

    // Sign in with Firebase Auth
    const userCredential: UserCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    return {
      success: true,
      user: userCredential.user,
      message: 'Signed in successfully!',
    };
  } catch (error) {
    const authError = error as AuthError;
    console.error('Sign in error:', authError.code, authError.message);

    return {
      success: false,
      user: null,
      message: getErrorMessage(authError.code),
      errorCode: authError.code,
    };
  }
};

/**
 * Sign In with Google
 * 
 * Authenticates user using Google OAuth.
 * For React Native, this requires additional setup with expo-auth-session
 * or react-native-google-signin for native implementation.
 * 
 * This function is designed for web popup-based sign-in.
 * For React Native, use signInWithGoogleNative() instead.
 * 
 * @returns Promise<AuthResponse> - Success status, user object, and message
 * 
 * @example
 * const result = await signInWithGoogle();
 * if (result.success) {
 *   console.log('Google sign-in successful:', result.user?.displayName);
 * }
 */
export const signInWithGoogle = async (): Promise<AuthResponse> => {
  try {
    if (Platform.OS !== 'web') {
      return {
        success: false,
        user: null,
        message:
          'Google popup sign-in is only available on web. Use credential-based Google sign-in on mobile.',
        errorCode: 'auth/unsupported-platform',
      };
    }

    // Use popup-based sign-in (web)
    const userCredential: UserCredential = await signInWithPopup(auth, googleProvider);

    // Get the Google Access Token (can be used to access Google APIs)
    const credential = GoogleAuthProvider.credentialFromResult(userCredential);
    const token = credential?.accessToken;

    console.log('Google sign-in successful, token available:', !!token);

    return {
      success: true,
      user: userCredential.user,
      message: 'Signed in with Google successfully!',
    };
  } catch (error) {
    const authError = error as AuthError;
    console.error('Google sign-in error:', authError.code, authError.message);

    return {
      success: false,
      user: null,
      message: getErrorMessage(authError.code),
      errorCode: authError.code,
    };
  }
};

// ============================================================================
// Phone Authentication Functions
// ============================================================================

/**
 * Send OTP to phone number for sign up or sign in
 * 
 * @param phoneNumber - Phone number in E.164 format (e.g., +919876543210)
 * @returns Promise<AuthResponse> - Success status and message
 */
export const sendPhoneOTP = async (phoneNumber: string): Promise<AuthResponse> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const result = await sendOTP(formattedPhone);

    if (!result.success) {
      return {
        success: false,
        user: null,
        message: result.message,
        errorCode: result.errorCode,
      };
    }

    return {
      success: true,
      user: null,
      message: 'OTP sent successfully to your phone!',
    };
  } catch (error: any) {
    console.error('Send phone OTP error:', error);
    return {
      success: false,
      user: null,
      message: 'Failed to send OTP. Please try again.',
      errorCode: 'phone/send-otp-failed',
    };
  }
};

/**
 * Sign up with phone number and OTP
 * Creates a new user account after verifying OTP
 * 
 * @param phoneNumber - Phone number in E.164 format
 * @param otp - 6-digit OTP code
 * @param tempPassword - Temporary password for Firebase Auth (auto-generated)
 * @returns Promise<AuthResponse> - Success status, user object, and message
 */
export const signUpWithPhone = async (
  phoneNumber: string,
  otp: string,
  tempPassword?: string
): Promise<AuthResponse> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Verify OTP first
    const verifyResult = await verifyOTP(formattedPhone, otp);
    
    if (!verifyResult.success || !verifyResult.valid) {
      return {
        success: false,
        user: null,
        message: verifyResult.message || 'Invalid OTP code',
        errorCode: 'phone/invalid-otp',
      };
    }

    // Create a Firebase Auth account with phone-based email
    // Since Firebase requires email, we create a unique email based on phone number
    const syntheticEmail = `${formattedPhone.replace(/\+/g, '')}@phone.app`;
    const password = tempPassword || generateRandomPassword();

    // Check if user already exists in Firebase Auth
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(
        auth,
        syntheticEmail,
        password
      );
    } catch (authError: any) {
      // If email already exists, user needs to sign in instead
      if (authError.code === 'auth/email-already-in-use') {
        return {
          success: false,
          user: null,
          message: 'An account with this phone number already exists. Please sign in instead.',
          errorCode: 'phone/phone-already-in-use',
        };
      }
      throw authError;
    }

    // Create profile document in Firestore (including password for phone sign-in)
    console.log('Creating Firestore profile for user:', userCredential.user.uid);
    try {
      await setDoc(
        doc(db, 'users', userCredential.user.uid),
        {
          phoneNumber: formattedPhone,
          mobileNumber: formattedPhone,
          isPhoneVerified: true,
          authMethod: 'phone',
          phoneAuthPassword: password, // Store password for sign-in
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log('Firestore profile created successfully with auth password');
    } catch (dbError) {
      console.error('Profile Firestore write failed:', dbError);
      // Don't fail signup if Firestore write fails
    }

    return {
      success: true,
      user: userCredential.user,
      message: 'Account created successfully!',
    };
  } catch (error: any) {
    console.error('Phone sign up error:', error);
    
    const authError = error as AuthError;
    return {
      success: false,
      user: null,
      message: getErrorMessage(authError.code) || 'Sign up failed. Please try again.',
      errorCode: authError.code,
    };
  }
};

/**
 * Sign in with phone number and OTP
 * 
 * @param phoneNumber - Phone number in E.164 format
 * @param otp - 6-digit OTP code
 * @returns Promise<AuthResponse> - Success status, user object, and message
 */
export const signInWithPhone = async (
  phoneNumber: string,
  otp: string
): Promise<AuthResponse> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Verify OTP first via backend
    console.log('Verifying OTP for sign-in:', formattedPhone);
    const verifyResult = await verifyOTP(formattedPhone, otp);
    
    if (!verifyResult.success || !verifyResult.valid) {
      return {
        success: false,
        user: null,
        message: verifyResult.message || 'Invalid OTP code',
        errorCode: 'phone/invalid-otp',
      };
    }

    console.log('OTP verified successfully');
    
    // Try to find the user in Firestore to get their password
    console.log('Looking up user profile...');
    const userProfile = await getUserByPhoneNumber(formattedPhone);
    
    if (!userProfile) {
      console.log('No user profile found in Firestore');
      return {
        success: false,
        user: null,
        message: 'No account found with this phone number. Please sign up first.',
        errorCode: 'phone/user-not-found',
      };
    }
    
    console.log('User profile found, attempting Firebase sign-in...');
    
    // Get the stored password for phone authentication
    let storedPassword = userProfile.phoneAuthPassword;
    
    // Get the user's Firebase Auth synthetic email
    const syntheticEmail = `${formattedPhone.replace(/\+/g, '')}@phone.app`;
    
    if (!storedPassword) {
      console.log('⚠️ Legacy account without stored password detected');
      console.log('Attempting to sign in anyway since OTP is verified...');
      
      // For legacy accounts, try multiple approaches
      // Approach 1: Check if already signed in
      if (auth.currentUser && auth.currentUser.email === syntheticEmail) {
        console.log('✓ User already authenticated in Firebase');
        
        // Update Firestore with a new password for future logins
        const newPassword = generateRandomPassword();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phoneNumber', '==', formattedPhone));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          await setDoc(
            doc(db, 'users', querySnapshot.docs[0].id),
            { phoneAuthPassword: newPassword },
            { merge: true }
          );
          console.log('✓ Password updated for future logins');
        }
        
        return {
          success: true,
          user: auth.currentUser,
          message: 'Signed in successfully!',
        };
      }
      
      // Approach 2: Try common passwords (last resort for migration)
      console.log('Trying to recover legacy account...');
      
      // Since we can't authenticate without the password, we need the user to re-register
      // But first, let's try to recover their data
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('phoneNumber', '==', formattedPhone));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return {
          success: false,
          user: null,
          message: 'Account data not found. Please sign up again.',
          errorCode: 'phone/data-not-found',
        };
      }
      
      return {
        success: false,
        user: null,
        message: 'Legacy account detected. Please delete your account in Firebase Console and sign up again, or contact support.',
        errorCode: 'phone/legacy-account',
      };
    }
    
    // Sign in with Firebase using the stored password
    console.log('Authenticating with Firebase Auth...');
    const userCredential = await signInWithEmailAndPassword(
      auth,
      syntheticEmail,
      storedPassword
    );
    
    console.log('Firebase authentication successful!');
    
    return {
      success: true,
      user: userCredential.user,
      message: 'Signed in successfully!',
    };
  } catch (error: any) {
    console.error('Phone sign in error:', error);
    const authError = error as AuthError;
    return {
      success: false,
      user: null,
      message: getErrorMessage(authError.code) || 'Sign in failed. Please try again.',
      errorCode: authError.code || 'phone/sign-in-failed',
    };
  }
};

/**
 * Complete phone sign-in after OTP verification
 * This function signs in the user using stored credentials
 * 
 * @param phoneNumber - Verified phone number
 * @returns Promise<AuthResponse>
 */
export const completePhoneSignIn = async (
  phoneNumber: string,
  storedPassword: string
): Promise<AuthResponse> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const syntheticEmail = `${formattedPhone.replace(/\+/g, '')}@phone.app`;
    
    const userCredential = await signInWithEmailAndPassword(
      auth,
      syntheticEmail,
      storedPassword
    );

    return {
      success: true,
      user: userCredential.user,
      message: 'Signed in successfully!',
    };
  } catch (error: any) {
    console.error('Complete phone sign in error:', error);
    return {
      success: false,
      user: null,
      message: 'Sign in failed. Please try again.',
      errorCode: error.code,
    };
  }
};

/**
 * Helper: Get user profile by phone number
 * Returns null if not found OR if there's a permission error
 */
const getUserByPhoneNumber = async (phoneNumber: string): Promise<UserProfileData | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('phoneNumber', '==', phoneNumber)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Also check mobileNumber field for backward compatibility
      const q2 = query(usersRef, where('mobileNumber', '==', phoneNumber));
      const querySnapshot2 = await getDocs(q2);
      
      if (querySnapshot2.empty) {
        console.log('No user found with phone number:', phoneNumber);
        return null;
      }
      
      const doc = querySnapshot2.docs[0];
      return { ...doc.data(), uid: doc.id } as UserProfileData;
    }
    
    const doc = querySnapshot.docs[0];
    return { ...doc.data(), uid: doc.id } as UserProfileData;
  } catch (error: any) {
    console.error('Error getting user by phone:', error);
    
    // If it's a permission error, we need to handle it differently
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
      console.warn('⚠️ Firestore permission error - Please deploy security rules!');
      console.warn('See firestore.rules file and deploy to Firebase Console');
    }
    
    // Return null instead of throwing - let the calling function handle it
    return null;
  }
};

/**
 * Helper: Generate random password for phone-based accounts
 */
const generateRandomPassword = (): string => {
  return Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
};

/**
 * Sign In with Google Credential (for React Native)
 * 
 * Use this when you have a Google ID token from a native Google Sign-In
 * implementation (e.g., expo-auth-session or react-native-google-signin).
 * 
 * @param idToken - Google ID token from native sign-in
 * @param accessToken - Optional Google access token
 * @returns Promise<AuthResponse> - Success status, user object, and message
 * 
 * @example
 * // After getting idToken from native Google Sign-In
 * const result = await signInWithGoogleCredential(idToken);
 */
export const signInWithGoogleCredential = async (
  idToken: string,
  accessToken?: string
): Promise<AuthResponse> => {
  try {
    if (!idToken) {
      return {
        success: false,
        user: null,
        message: 'Google ID token is required.',
        errorCode: 'validation/missing-token',
      };
    }

    // Create credential from Google ID token
    const credential = GoogleAuthProvider.credential(idToken, accessToken);

    // Sign in with the credential
    const userCredential: UserCredential = await signInWithCredential(
      auth,
      credential
    );

    // Ensure a profile document exists
    try {
      await setDoc(
        doc(db, 'users', userCredential.user.uid),
        {
          email: userCredential.user.email,
          fullName: userCredential.user.displayName,
          profilePhoto: userCredential.user.photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (dbError) {
      console.warn('Profile Firestore write failed:', dbError);
    }

    return {
      success: true,
      user: userCredential.user,
      message: 'Signed in with Google successfully!',
    };
  } catch (error) {
    const authError = error as AuthError;
    console.error('Google credential sign-in error:', authError.code, authError.message);

    return {
      success: false,
      user: null,
      message: getErrorMessage(authError.code),
      errorCode: authError.code,
    };
  }
};

/**
 * Save/Update the signed-in user's profile in Firestore.
 * This is used by Profile screen and during Sign Up.
 */
export const saveCurrentUserProfile = async (
  profile: UserProfileData
): Promise<{ success: boolean; message: string }> => {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, message: 'No authenticated user.' };
  }

  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        ...profile,
        email: user.email ?? profile.email,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true, message: 'Profile saved.' };
  } catch (e) {
    console.error('saveCurrentUserProfile error:', e);
    return { success: false, message: 'Failed to save profile.' };
  }
};

/**
 * Fetch the current user's profile from Firestore.
 */
export const fetchCurrentUserProfile = async (): Promise<
  { success: true; profile: UserProfileData } | { success: false; message: string }
> => {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, message: 'No authenticated user.' };
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const profile = (snap.exists() ? (snap.data() as UserProfileData) : {}) as UserProfileData;
    return { success: true, profile };
  } catch (e) {
    console.error('fetchCurrentUserProfile error:', e);
    return { success: false, message: 'Failed to load profile.' };
  }
};

/**
 * Upload profile picture to Firebase Storage
 */
export const uploadProfilePicture = async (uri: string): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    // 1. Fetch the blob from the URI
    const response = await fetch(uri);
    const blob = await response.blob();

    // 2. Create a reference to the storage location
    const fileRef = ref(storage, `profile_photos/${user.uid}_${Date.now()}.jpg`);

    // 3. Upload the blob
    await uploadBytes(fileRef, blob);

    // 4. Get and return the download URL
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return null;
  }
};

/**
 * Update Firebase Auth displayName/photoURL for the current user.
 */
export const updateCurrentAuthProfile = async (params: {
  displayName?: string;
  photoURL?: string;
}): Promise<{ success: boolean; message: string }> => {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, message: 'No authenticated user.' };
  }

  try {
    await updateProfile(user, {
      displayName: params.displayName,
      photoURL: params.photoURL,
    });
    return { success: true, message: 'Auth profile updated.' };
  } catch (e) {
    console.error('updateCurrentAuthProfile error:', e);
    return { success: false, message: 'Failed to update auth profile.' };
  }
};

/**
 * Logout
 * 
 * Signs out the current user and clears the session.
 * 
 * @returns Promise<AuthResponse> - Success status and message
 * 
 * @example
 * const result = await logout();
 * if (result.success) {
 *   // Navigate to login screen
 *   navigation.navigate('SignIn');
 * }
 */
export const logout = async (): Promise<AuthResponse> => {
  try {
    await signOut(auth);

    return {
      success: true,
      user: null,
      message: 'Signed out successfully!',
    };
  } catch (error) {
    const authError = error as AuthError;
    console.error('Logout error:', authError.code, authError.message);

    return {
      success: false,
      user: null,
      message: 'Failed to sign out. Please try again.',
      errorCode: authError.code,
    };
  }
};

/**
 * Get Current User
 * 
 * Returns the currently authenticated user or null if not authenticated.
 * 
 * @returns User | null - Current user object or null
 * 
 * @example
 * const user = getCurrentUser();
 * if (user) {
 *   console.log('User is logged in:', user.email);
 * }
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Subscribe to Auth State Changes
 * 
 * Sets up a listener for authentication state changes.
 * Useful for updating UI when user logs in or out.
 * 
 * @param callback - Function called when auth state changes
 * @returns Unsubscribe function - Call to stop listening
 * 
 * @example
 * useEffect(() => {
 *   const unsubscribe = onAuthStateChange((user) => {
 *     if (user) {
 *       setIsLoggedIn(true);
 *     } else {
 *       setIsLoggedIn(false);
 *     }
 *   });
 *   return () => unsubscribe();
 * }, []);
 */
export const onAuthStateChange = (
  callback: (user: User | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

// Export auth instance for advanced use cases
export { auth };
