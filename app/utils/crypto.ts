/**
 * Crypto Utility Functions
 *
 * Helper functions for cryptographic operations (phone number hashing)
 */

/**
 * Clean phone number (remove all non-digit characters except +)
 */
export const cleanPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters except +
  return phone.replace(/[^\d+]/g, '');
};

/**
 * Hash phone number using SHA-256
 * Returns hex string (64 characters)
 */
export const hashPhoneNumber = async (phone: string): Promise<string> => {
  const cleaned = cleanPhoneNumber(phone);

  if (typeof window === 'undefined') {
    // Server-side: use Node.js crypto
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(cleaned).digest('hex');
  }

  // Browser: use Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(cleaned);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

/**
 * Hash multiple phone numbers
 * Returns array of hashed phone numbers
 */
export const hashPhoneNumbers = async (
  phoneNumbers: string[]
): Promise<string[]> => {
  const hashes = await Promise.all(
    phoneNumbers.map(phone => hashPhoneNumber(phone))
  );
  return hashes;
};
