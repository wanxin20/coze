import { Types } from 'mongoose';
import crypto from 'crypto';

/**
 * Safely convert a string to ObjectId, returns a default ObjectId if invalid
 */
export function safeObjectId(id: string | undefined | null, defaultId?: string): Types.ObjectId {
  // Handle common non-ObjectId team ID formats from other services
  if (id) {
    // If it's already a valid ObjectId, use it
    if (Types.ObjectId.isValid(id)) {
      return new Types.ObjectId(id);
    }
    
    // Handle common string team IDs by mapping them to valid ObjectIds
    const teamIdMappings: Record<string, string> = {
      'default-team': '000000000000000000000001',
      'default': '000000000000000000000001',
      'admin': '000000000000000000000001',
      'system': '000000000000000000000001'
    };
    
    if (teamIdMappings[id]) {
      return new Types.ObjectId(teamIdMappings[id]);
    }
    
    // Try to create a deterministic ObjectId from the string
    // This ensures consistent mapping for the same string
    try {
      const hash = crypto.createHash('md5').update(id).digest('hex');
      const objectIdStr = hash.substring(0, 24);
      if (Types.ObjectId.isValid(objectIdStr)) {
        return new Types.ObjectId(objectIdStr);
      }
    } catch (error) {
      // Fallback to default if hashing fails
    }
  }
  
  // Return a default ObjectId if provided
  if (defaultId && Types.ObjectId.isValid(defaultId)) {
    return new Types.ObjectId(defaultId);
  }
  
  // Return a standard default ObjectId
  return new Types.ObjectId('000000000000000000000001');
}

/**
 * Check if a string is a valid ObjectId
 */
export function isValidObjectId(id: string | undefined | null): boolean {
  return id ? Types.ObjectId.isValid(id) : false;
}

/**
 * Convert string to ObjectId with validation
 */
export function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ObjectId format: ${id}`);
  }
  return new Types.ObjectId(id);
}

/**
 * Convert string to ObjectId, return null if invalid
 */
export function toObjectIdOrNull(id: string | undefined | null): Types.ObjectId | null {
  if (!id || !Types.ObjectId.isValid(id)) {
    return null;
  }
  return new Types.ObjectId(id);
}

/**
 * Convert array of strings to ObjectIds, filtering out invalid ones
 */
export function toObjectIds(ids: string[]): Types.ObjectId[] {
  return ids
    .filter(id => Types.ObjectId.isValid(id))
    .map(id => new Types.ObjectId(id));
}

/**
 * Generate a new ObjectId
 */
export function generateObjectId(): Types.ObjectId {
  return new Types.ObjectId();
}

/**
 * Get default team ObjectId
 */
export function getDefaultTeamId(): Types.ObjectId {
  return new Types.ObjectId('000000000000000000000001');
}

/**
 * Get default user ObjectId
 */
export function getDefaultUserId(): Types.ObjectId {
  return new Types.ObjectId('000000000000000000000002');
}