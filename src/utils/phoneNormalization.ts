/**
 * Phone number normalization utility for WhatsApp
 * Ensures phone numbers are in the format: +<country_code><number>
 */

/**
 * Normalize a phone number to WhatsApp format (+<country_code><number>)
 * @param phone - Raw phone number (can have spaces, hyphens, country codes in various formats)
 * @param defaultCountryCode - Default country code if not provided (default: 91 for India)
 * @returns Normalized phone number in format +<country_code><number>
 */
export const normalizePhoneNumber = (
  phone: string,
  defaultCountryCode: string = '91'
): string => {
  if (!phone) return '';

  // Remove all whitespace and special formatting characters
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // If already starts with +, ensure no leading 0
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.substring(1).replace(/^0+/, '');
    return cleaned;
  }

  // Remove leading zeros (common in India: 0XXXXXXXXXX)
  cleaned = cleaned.replace(/^0+/, '');

  // Check if it starts with country code digit pattern (1-3 digits)
  // If not, assume it's just the phone number
  const hasCountryCode = /^\d{1,3}\d{6,}/.test(cleaned);

  if (hasCountryCode && cleaned.length > 10) {
    // Likely has country code already
    return '+' + cleaned;
  }

  // Check if it looks like it might have country code (e.g., "91-98765-43210")
  const countryCodeMatch = cleaned.match(/^(\d{1,3})(\d{10,})$/);
  if (countryCodeMatch && countryCodeMatch[2].length >= 10) {
    const cc = countryCodeMatch[1];
    const phoneNum = countryCodeMatch[2];
    // If first digits form a valid country code range, use it
    if (parseInt(cc) >= 1 && parseInt(cc) <= 999) {
      return '+' + cc + phoneNum;
    }
  }

  // No country code found, append default
  return '+' + defaultCountryCode + cleaned;
};

/**
 * Validate if a phone number is in correct WhatsApp format
 * @param phone - Phone number to validate
 * @returns true if valid WhatsApp format
 */
export const isValidWhatsAppPhone = (phone: string): boolean => {
  if (!phone) return false;
  
  // Must start with + and have country code + at least 10 digits
  return /^\+\d{1,3}\d{9,14}$/.test(phone);
};

/**
 * Format phone for display (user-friendly format)
 * @param phone - Phone number (any format)
 * @returns Formatted phone for display
 */
export const formatPhoneForDisplay = (phone: string): string => {
  const normalized = normalizePhoneNumber(phone);
  // Remove + for display, or keep it - adjust based on preference
  return normalized.startsWith('+') ? normalized.substring(1) : normalized;
};
