import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from '../../../domain/errors/domain-error';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestId = request.id;
  const timestamp = new Date().toISOString();

  // 1. Handle Domain Errors (Known business logic errors)
  if (error instanceof DomainError) {
    // Log 4xx as warn, 5xx as error
    if (error.statusCode >= 500) {
      request.log.error({ err: error, requestId }, 'Domain Error (5xx)');
    } else {
      request.log.warn({ err: error, requestId }, 'Domain Error (4xx)');
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      meta: {
        requestId,
        timestamp,
      },
    };

    if (error.statusCode === 429 && typeof error.details === 'object' && error.details !== null && 'retryAfter' in error.details) {
      reply.header('Retry-After', (error.details as any).retryAfter);
    }

    return reply.status(error.statusCode).send(response);
  }

  // 2. Handle Zod Validation Errors
  if (error instanceof ZodError) {
    request.log.warn({ err: error, requestId }, 'Validation Error');

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.flatten().fieldErrors,
      },
      meta: {
        requestId,
        timestamp,
      },
    };

    return reply.status(400).send(response);
  }

  // 3. Handle Fastify Validation Errors (if any leak through)
  if ((error as FastifyError).validation) {
    request.log.warn({ err: error, requestId }, 'Fastify Validation Error');
    
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: (error as FastifyError).validation,
      },
      meta: {
        requestId,
        timestamp,
      },
    };
    
    return reply.status(400).send(response);
  }

  // 4. Handle Rate Limiting Errors (from @fastify/rate-limit)
  if ((error as any).statusCode === 429) {
    request.log.warn({ err: error, requestId }, 'Rate Limit Exceeded');
    
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        details: {
          retryAfter: reply.getHeader('Retry-After') || 60
        }
      },
      meta: {
        requestId,
        timestamp,
      },
    };
    return reply.status(429).send(response);
  }

  // 5. Handle Unknown Errors (Internal Server Error)
  request.log.error({ err: error, requestId }, 'Unexpected Error');

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      // Don't expose internal error details in production
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
    meta: {
      requestId,
      timestamp,
    },
  };

  return reply.status(500).send(response);
}
