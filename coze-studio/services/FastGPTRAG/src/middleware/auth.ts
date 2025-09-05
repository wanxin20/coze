import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface AuthUser {
  userId: string;
  teamId: string;
  tmbId: string;
  role: 'owner' | 'admin' | 'member';
  permissions: string[];
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// JWT token verification middleware
export function verifyToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        code: 401,
        message: 'Access token required',
        data: null
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    
    req.user = {
      userId: decoded.userId || decoded.sub,
      teamId: decoded.teamId,
      tmbId: decoded.tmbId || decoded.userId,
      role: decoded.role || 'member',
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    logger.warn('Token verification failed:', error);
    return res.status(401).json({
      code: 401,
      message: 'Invalid or expired token',
      data: null
    });
  }
}

// API key verification middleware
export function verifyApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({
        code: 401,
        message: 'API key required',
        data: null
      });
    }

    // TODO: Implement API key validation against database
    // For now, use simple validation
    if (!isValidApiKey(apiKey)) {
      return res.status(401).json({
        code: 401,
        message: 'Invalid API key',
        data: null
      });
    }

    // Set user context from API key
    const userContext = getUserContextFromApiKey(apiKey);
    req.user = userContext;

    next();
  } catch (error) {
    logger.warn('API key verification failed:', error);
    return res.status(401).json({
      code: 401,
      message: 'API key verification failed',
      data: null
    });
  }
}

// Flexible auth middleware (supports both token and API key)
export function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractToken(req);
  const apiKey = req.headers['x-api-key'] as string;
  
  // Check for manual headers (fallback for testing)
  const manualTeamId = req.headers['x-team-id'] as string;
  const manualUserId = req.headers['x-user-id'] as string;
  
  if (manualTeamId && manualUserId) {
    // Allow manual override for development/testing
    req.user = {
      userId: manualUserId,
      teamId: manualTeamId,
      tmbId: manualUserId,
      role: 'admin',
      permissions: ['read', 'write', 'delete']
    };
    return next();
  }

  if (token) {
    return verifyToken(req, res, next);
  } else if (apiKey) {
    return verifyApiKey(req, res, next);
  } else {
    return res.status(401).json({
      code: 401,
      message: 'Authentication required (token or API key)',
      data: null
    });
  }
}

// Permission checking middleware
export function requirePermissions(permissions: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        message: 'Authentication required',
        data: null
      });
    }

    // Check if user has required permissions
    const hasPermission = permissions.some(permission => 
      req.user!.permissions.includes(permission) || 
      req.user!.role === 'owner' || 
      req.user!.role === 'admin'
    );

    if (!hasPermission) {
      return res.status(403).json({
        code: 403,
        message: 'Insufficient permissions',
        data: {
          required: permissions,
          current: req.user.permissions
        }
      });
    }

    next();
  };
}

// Role-based access control
export function requireRole(roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        message: 'Authentication required',
        data: null
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: 403,
        message: 'Insufficient role',
        data: {
          required: roles,
          current: req.user.role
        }
      });
    }

    next();
  };
}

// Rate limiting middleware
export function rateLimit(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: express.Request) => string;
}) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = options.keyGenerator ? options.keyGenerator(req) : 
                req.ip || req.user?.userId || 'anonymous';
    
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Clean up old entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < windowStart) {
        requests.delete(k);
      }
    }
    
    const userRequests = requests.get(key);
    
    if (!userRequests) {
      requests.set(key, { count: 1, resetTime: now });
      return next();
    }
    
    if (userRequests.resetTime < windowStart) {
      // Reset window
      userRequests.count = 1;
      userRequests.resetTime = now;
      return next();
    }
    
    if (userRequests.count >= options.maxRequests) {
      return res.status(429).json({
        code: 429,
        message: 'Rate limit exceeded',
        data: {
          limit: options.maxRequests,
          windowMs: options.windowMs,
          retryAfter: Math.ceil((userRequests.resetTime + options.windowMs - now) / 1000)
        }
      });
    }
    
    userRequests.count++;
    next();
  };
}

// IP whitelist middleware
export function ipWhitelist(allowedIPs: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn(`Access denied for IP: ${clientIP}`);
      return res.status(403).json({
        code: 403,
        message: 'IP not allowed',
        data: null
      });
    }
    
    next();
  };
}

// Utility functions
function extractToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check for token in query parameter
  return req.query.token as string || null;
}

function isValidApiKey(apiKey: string): boolean {
  // TODO: Implement proper API key validation
  // This should check against a database of valid API keys
  return apiKey.length >= 32 && apiKey.startsWith('sk-');
}

function getUserContextFromApiKey(apiKey: string): AuthUser {
  // TODO: Implement proper API key to user mapping
  // This should look up the user associated with the API key
  return {
    userId: 'api-user',
    teamId: 'api-team',
    tmbId: 'api-user',
    role: 'member',
    permissions: ['read', 'write']
  };
}

// Create JWT token
export function createToken(user: {
  userId: string;
  teamId: string;
  tmbId: string;
  role: string;
  permissions: string[];
}): string {
  return jwt.sign(
    {
      sub: user.userId,
      userId: user.userId,
      teamId: user.teamId,
      tmbId: user.tmbId,
      role: user.role,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000)
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

// Validate permissions for dataset access
export function validateDatasetAccess(
  user: AuthUser,
  datasetId: string,
  operation: 'read' | 'write' | 'delete'
): boolean {
  // TODO: Implement proper dataset permission checking
  // This should check user's permissions for the specific dataset
  
  // For now, allow all operations for authenticated users
  return true;
}

// Audit logging middleware
export function auditLog(req: express.Request, res: express.Response, next: express.NextFunction) {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log the request after response is sent
    if (req.user) {
      logger.info('API Audit', {
        userId: req.user.userId,
        teamId: req.user.teamId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}
