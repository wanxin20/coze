
import winston from 'winston';
import path from 'path';
import { config } from '../config/index.js';

// Create logs directory if it doesn't exist
const logDir = config.logFilePath;

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fastgpt-rag' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

// Add console transport for all environments
// In production, we still want to see logs in Docker containers
const shouldLogToConsole = config.nodeEnv !== 'production' || 
  process.env.FORCE_VERBOSE_LOGGING === 'true' || 
  process.env.VERBOSE_LOGGING === 'true';

if (shouldLogToConsole) {
  logger.add(
    new winston.transports.Console({
      level: config.logLevel, // Use the same log level as configured
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let metaStr = '';
          if (Object.keys(meta).length) {
            try {
              // Safe JSON stringify to handle circular references and complex objects
              const seen = new WeakSet();
              metaStr = JSON.stringify(meta, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                  // Check for circular references using WeakSet
                  if (seen.has(value)) {
                    return '[Circular Reference]';
                  }
                  seen.add(value);
                  
                  // Handle common HTTP/network objects that often have circular refs
                  const constructorName = value.constructor?.name;
                  if (constructorName === 'ClientRequest' || 
                      constructorName === 'IncomingMessage' ||
                      constructorName === 'Socket' ||
                      constructorName === 'TLSSocket' ||
                      constructorName === 'HTTPParser' ||
                      constructorName === 'Agent' ||
                      constructorName === 'Server') {
                    return `[${constructorName} Object]`;
                  }
                  
                  // Handle Request and Response objects from Express
                  if (constructorName === 'IncomingMessage' && value.method && value.url) {
                    return `[HTTP Request: ${value.method} ${value.url}]`;
                  }
                  if (constructorName === 'ServerResponse') {
                    return `[HTTP Response: ${value.statusCode || 'pending'}]`;
                  }
                  
                  // Handle Error objects specially to preserve stack traces
                  if (value instanceof Error) {
                    return {
                      name: value.name,
                      message: value.message,
                      stack: value.stack
                    };
                  }
                  
                  // Handle large objects by truncating
                  const keys = Object.keys(value);
                  if (keys.length > 20) {
                    return `[Large Object with ${keys.length} properties]`;
                  }
                }
                
                // Handle functions
                if (typeof value === 'function') {
                  return `[Function: ${value.name || 'anonymous'}]`;
                }
                
                // Handle very long strings
                if (typeof value === 'string' && value.length > 1000) {
                  return value.substring(0, 1000) + '... [truncated]';
                }
                
                return value;
              });
            } catch (error: any) {
              // If JSON.stringify still fails, provide more detailed fallback
              metaStr = `[JSON Stringify Error: ${error?.message || 'Unknown error'}]`;
              console.warn('Logger JSON stringify failed:', error?.message || 'Unknown error');
            }
          }
          return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
        })
      )
    })
  );
} else {
  // Even in production without verbose logging, show important startup info
  logger.add(
    new winston.transports.Console({
      level: 'info', // Only show info level and above
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, service }) => {
          return `${timestamp} [${service}] ${level}: ${message}`;
        })
      )
    })
  );
}

export { logger };
