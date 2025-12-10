export abstract class DomainError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(message, code, 401);
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(message, code, 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super(
      `${resource} not found${id ? `: ${id}` : ''}`,
      `${resource.toUpperCase()}_NOT_FOUND`,
      404
    );
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, code, 409);
  }
}

export class BusinessLogicError extends DomainError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, 400, details);
  }
}

export class RateLimitError extends DomainError {
  constructor(retryAfter: number) {
    super('Too many requests', 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}

export class InternalServerError extends DomainError {
  constructor(message = 'Internal server error') {
    super(message, 'INTERNAL_ERROR', 500);
  }
}

export class InvariantViolationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'INVARIANT_VIOLATION', 500, details);
  }
}

export class CircuitBreakerOpenError extends DomainError {
  constructor(message: string) {
    super(message, 'CIRCUIT_BREAKER_OPEN', 503);
  }
}
