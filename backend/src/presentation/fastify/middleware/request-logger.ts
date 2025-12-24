import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Request/Response Logger Middleware
 * 
 * Logs all incoming requests and outgoing responses with:
 * - Request method, URL, and query params
 * - Response status code and timing
 * - User ID (if authenticated)
 * - Error information (if any)
 */

export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const startTime = Date.now();
  const { method, url, query, headers } = request;

  // Log incoming request
  request.log.info({
    type: 'request',
    method,
    url,
    query,
    userAgent: headers['user-agent'],
    ip: request.ip,
  }, 'Incoming request');

  // Hook to log response
  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = reply;

    const logData = {
      type: 'response',
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
    };

    // Log level based on status code and duration
    if (statusCode >= 500) {
      request.log.error(logData, 'Request failed (5xx)');
    } else if (statusCode >= 400) {
      request.log.warn(logData, 'Request error (4xx)');
    } else if (duration > 1000) {
      request.log.warn(logData, 'Slow request (>1s)');
    } else {
      request.log.info(logData, 'Request completed');
    }
  });
}

