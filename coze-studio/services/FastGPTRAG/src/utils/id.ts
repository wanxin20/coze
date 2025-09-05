import crypto from 'crypto';

/**
 * Generate a random ID
 */
export function generateId(length: number = 12): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a short ID (nanoid-like)
 */
export function generateShortId(length: number = 8): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  
  return result;
}

/**
 * Generate a timestamp-based ID
 */
export function generateTimestampId(): string {
  return Date.now().toString(36) + generateShortId(6);
}

/**
 * Generate a deterministic ID based on input
 */
export function generateDeterministicId(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}
