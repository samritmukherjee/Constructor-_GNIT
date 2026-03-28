/**
 * Twilio Service for SMS OTP Authentication
 * 
 * This module handles sending and verifying OTP codes via SMS using Twilio.
 * It communicates with a backend API that interfaces with Twilio's Verify API.
 */

import axios from 'axios';
import { Platform } from 'react-native';

// Configure axios defaults for better React Native compatibility
axios.defaults.timeout = 30000;
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface OTPResponse {
  success: boolean;
  message: string;
  sid?: string;
  errorCode?: string;
}

interface VerifyOTPResponse {
  success: boolean;
  message: string;
  valid?: boolean;
  errorCode?: string;
}

// ============================================================================
// Configuration
// ============================================================================

// For Android emulator, localhost needs to be replaced with 10.0.2.2
// which is the special IP that refers to the host machine
const getApiEndpoint = () => {
  const endpoint = process.env.EXPO_PUBLIC_TWILIO_API_ENDPOINT || '';
  
  if (Platform.OS === 'android' && endpoint.includes('localhost')) {
    return endpoint.replace('localhost', '10.0.2.2');
  }
  
  return endpoint;
};

const TWILIO_API_ENDPOINT = getApiEndpoint();
const TWILIO_ACCOUNT_SID = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN || '';
const TWILIO_VERIFY_SERVICE_SID = process.env.EXPO_PUBLIC_TWILIO_VERIFY_SERVICE_SID || '';

/**
 * Error messages for common Twilio errors
 */
const TWILIO_ERROR_MESSAGES: Record<string, string> = {
  '60200': 'Invalid phone number format. Please enter a valid phone number.',
  '60203': 'Maximum send attempts reached. Please try again later.',
  '60205': 'SMS send rate limit exceeded. Please try again in a few minutes.',
  '60212': 'Too many attempts. Please try again later.',
  '60223': 'Invalid verification code. Please check and try again.',
  '21211': 'This phone number is not verified. Using a Twilio trial account? Please verify your phone number at console.twilio.com first.',
  '21608': 'Phone number not verified for trial account. Please verify it in Twilio console or upgrade your account.',
  'network-error': 'Network error. Please check your connection and try again.',
  'default': 'An error occurred. Please try again.',
};

const getTwilioErrorMessage = (errorCode: string): string => {
  return TWILIO_ERROR_MESSAGES[errorCode] || TWILIO_ERROR_MESSAGES['default'];
};

// ============================================================================
// OTP Functions
// ============================================================================

/**
 * Test API connectivity
 * Useful for debugging network issues
 */
export const testAPIConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Testing API connection to:', TWILIO_API_ENDPOINT);
    
    if (!TWILIO_API_ENDPOINT) {
      return {
        success: false,
        message: 'API endpoint not configured',
      };
    }
    
    const response = await axios.get(`${TWILIO_API_ENDPOINT.replace('/api', '')}/api/health`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log('API connection test successful:', response.data);
    
    return {
      success: true,
      message: `Connected to API: ${response.data.message}`,
    };
  } catch (error: any) {
    console.error('API connection test failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });
    
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
    };
  }
};

/**
 * Send OTP via SMS to a phone number
 */
export const sendOTP = async (phoneNumber: string): Promise<OTPResponse> => {
  try {
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      return {
        success: false,
        message: 'Phone number must be in international format (e.g., +919876543210)',
        errorCode: 'validation/invalid-phone',
      };
    }

    if (TWILIO_API_ENDPOINT) {
      console.log(`Sending OTP to ${phoneNumber} via API: ${TWILIO_API_ENDPOINT}/send-otp`);
      
      try {
        const response = await axios.post(
          `${TWILIO_API_ENDPOINT}/send-otp`,
          { phoneNumber },
          {
            timeout: 30000, // Increased to 30 seconds for slower networks
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          }
        );

        console.log('OTP sent successfully:', response.data);
        
        return {
          success: true,
          message: 'OTP sent successfully!',
          sid: response.data.sid,
        };
      } catch (axiosError: any) {
        console.error('Axios error sending OTP:', {
          message: axiosError.message,
          code: axiosError.code,
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          url: `${TWILIO_API_ENDPOINT}/send-otp`,
        });
        
        // Handle specific network errors
        if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
          return {
            success: false,
            message: 'Network error. Please check your internet connection and try again.',
            errorCode: 'network-error',
          };
        }
        
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          return {
            success: false,
            message: 'Request timeout. Please try again.',
            errorCode: 'timeout',
          };
        }
        
        // Handle Twilio-specific errors
        const twilioErrorCode = axiosError?.response?.data?.code;
        const errorMessage = axiosError?.response?.data?.error;
        
        // Check for unverified number error (Twilio trial account)
        if (errorMessage && errorMessage.includes('unverified') || twilioErrorCode === 21211 || twilioErrorCode === 21608) {
          return {
            success: false,
            message: '⚠️ Phone number not verified for Twilio trial account.\n\nPlease verify your phone number at:\nconsole.twilio.com/phone-numbers/verified\n\nOr upgrade to a paid Twilio account to send to any number.',
            errorCode: String(twilioErrorCode || '21608'),
          };
        }
        
        const errorCode = twilioErrorCode || axiosError?.code || 'default';
        return {
          success: false,
          message: errorMessage || getTwilioErrorMessage(String(errorCode)),
          errorCode: String(errorCode),
        };
      }
    } else {
      // Direct Twilio call via REST API (for testing only)
      // We use axios directly instead of the 'twilio' Node SDK because it's not compatible with React Native
      const response = await axios.post(
        `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
        `To=${encodeURIComponent(phoneNumber)}&Channel=sms`,
        {
          auth: {
            username: TWILIO_ACCOUNT_SID,
            password: TWILIO_AUTH_TOKEN
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        success: true,
        message: 'OTP sent successfully!',
        sid: response.data.sid,
      };
    }
  } catch (error: any) {
    console.error('Send OTP error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      endpoint: TWILIO_API_ENDPOINT
    });
    
    const errorCode = error?.response?.data?.code || error?.code || 'default';
    return {
      success: false,
      message: getTwilioErrorMessage(errorCode),
      errorCode,
    };
  }
};

/**
 * Verify OTP code entered by user
 */
export const verifyOTP = async (
  phoneNumber: string,
  code: string
): Promise<VerifyOTPResponse> => {
  try {
    if (!phoneNumber || !code) {
      return {
        success: false,
        valid: false,
        message: 'Phone number and verification code are required.',
        errorCode: 'validation/missing-fields',
      };
    }

    if (!/^\d{6}$/.test(code)) {
      return {
        success: false,
        valid: false,
        message: 'Verification code must be 6 digits.',
        errorCode: 'validation/invalid-code-format',
      };
    }

    if (TWILIO_API_ENDPOINT) {
      try {
        const response = await axios.post(
          `${TWILIO_API_ENDPOINT}/verify-otp`,
          { phoneNumber, code },
          {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          }
        );

        return {
          success: true,
          valid: response.data.valid === true,
          message: response.data.valid
            ? 'Phone number verified successfully!'
            : 'Invalid verification code.',
        };
      } catch (axiosError: any) {
        console.error('Axios error verifying OTP:', {
          message: axiosError.message,
          code: axiosError.code,
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });
        
        if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
          return {
            success: false,
            valid: false,
            message: 'Network error. Please check your internet connection and try again.',
            errorCode: 'network-error',
          };
        }
        
        const errorCode = axiosError?.response?.data?.code || axiosError?.code || 'default';
        return {
          success: false,
          valid: false,
          message: axiosError?.response?.data?.error || getTwilioErrorMessage(errorCode),
          errorCode,
        };
      }
    } else {
      // Direct Twilio call via REST API (for testing only)
      const response = await axios.post(
        `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
        `To=${encodeURIComponent(phoneNumber)}&Code=${encodeURIComponent(code)}`,
        {
          auth: {
            username: TWILIO_ACCOUNT_SID,
            password: TWILIO_AUTH_TOKEN
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const isValid = response.data.status === 'approved';

      return {
        success: true,
        valid: isValid,
        message: isValid
          ? 'Phone number verified successfully!'
          : 'Invalid or expired verification code.',
      };
    }
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    const errorCode = error?.response?.data?.code || error?.code || 'default';
    return {
      success: false,
      valid: false,
      message: getTwilioErrorMessage(errorCode),
      errorCode,
    };
  }
};

/**
 * Format phone number to E.164 format
 */
export const formatPhoneNumber = (
  phoneNumber: string,
  countryCode: string = '+91'
): string => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  return `${countryCode}${cleaned}`;
};

/**
 * Validate phone number format
 */
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  const indianPhoneRegex = /^(\+91)?[6-9]\d{9}$/;
  return indianPhoneRegex.test(phoneNumber.replace(/\s/g, ''));
};
