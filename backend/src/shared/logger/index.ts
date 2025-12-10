import { FastifyLoggerOptions, FastifyRequest } from 'fastify';
import { getEnv } from '../config/env';

const isProduction = getEnv('NODE_ENV', 'development') === 'production';

// Pino logger configuration
export const loggerConfig = {
  level: getEnv('LOG_LEVEL', isProduction ? 'info' : 'debug'),

  // Custom formatters
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },

  // Serializers for request, response, and error objects
  serializers: {
    req: (req: FastifyRequest) => {
      return {
        method: req.method,
        url: req.url,
        // Hostname and remote address are useful for auditing
        hostname: req.hostname,
        remoteAddress: req.ip,
        // Include requestId if available in the request object (Fastify adds it)
        requestId: req.id,
        // Log client version if provided in headers
        clientVersion: req.headers['x-client-version']
      };
    },
    res: (res: any) => {
      return {
        statusCode: res.statusCode
      };
    },
    err: (err: any) => {
      return {
        type: err.type || err.name,
        message: err.message,
        stack: err.stack,
        code: err.code || err.statusCode,
        // Include validation errors if available (common in Zod/Fastify)
        validation: err.validation
      };
    }
  },

  // Redaction for sensitive data
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'secret',
      'key',
      '*.password',
      '*.token',
      '*.secret',
      '*.key',
      'email', // PII often redacted in logs unless necessary
      '*.email'
    ],
    remove: true
  },

  // ISO timestamp for better parsing by log aggregators
  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  // Mixin to add static data to every log
  mixin: () => {
    return {
      // You could add version/commit hash here if available
      app: 'backend'
    };
  }
};
