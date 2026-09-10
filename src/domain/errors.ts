export class DomainError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "DomainError";
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(message: string) {
    super("INVALID_TRANSITION", message, 409);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} ${id} not found`, 404);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "You do not have permission to perform this action") {
    super("FORBIDDEN", message, 403);
  }
}

/**
 * Distinct from the generic ForbiddenError (wrong role) — this means the
 * requester's role is allowed to perform this kind of action in general,
 * but they are not on *this specific patient's* care team. See
 * src/lib/authorization.ts.
 */
export class PatientAccessDeniedError extends DomainError {
  constructor(message = "You do not have access to this patient.") {
    super("PATIENT_ACCESS_DENIED", message, 403);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 422);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}
