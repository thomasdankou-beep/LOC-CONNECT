export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "STOCK_INSUFFICIENT"
  | "HOLD_LIMIT_REACHED"
  | "HOLD_EXPIRED"
  | "RATE_LIMITED"
  | "INVALID_TRANSITION"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "MODIFICATION_NOT_ALLOWED"
  | "MODIFICATION_DEADLINE_EXCEEDED"
  | "MODIFICATION_REQUIRES_APPROVAL"
  | "DEPOSIT_ADJUSTMENT_REQUIRED"
  | "MODIFICATION_ALREADY_APPLIED"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_SUSPENDED"
  | "CSRF_REJECTED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  STOCK_INSUFFICIENT: 409,
  HOLD_LIMIT_REACHED: 409,
  HOLD_EXPIRED: 410,
  RATE_LIMITED: 429,
  INVALID_TRANSITION: 409,
  PAYMENT_REQUIRED: 402,
  PAYMENT_AMOUNT_MISMATCH: 409,
  MODIFICATION_NOT_ALLOWED: 409,
  MODIFICATION_DEADLINE_EXCEEDED: 409,
  MODIFICATION_REQUIRES_APPROVAL: 409,
  DEPOSIT_ADJUSTMENT_REQUIRED: 402,
  MODIFICATION_ALREADY_APPLIED: 409,
  ACCOUNT_LOCKED: 423,
  ACCOUNT_SUSPENDED: 403,
  CSRF_REJECTED: 403,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(code: ErrorCode, message: string, details?: unknown, headers?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
    this.headers = headers;
  }
}

export const notFound = (what = "Ressource") => new AppError("NOT_FOUND", `${what} introuvable.`);
export const forbidden = (message = "Vous n'avez pas accès à cette ressource.") => new AppError("FORBIDDEN", message);
export const conflict = (message: string, details?: unknown) => new AppError("CONFLICT", message, details);
export const invalid = (message: string, details?: unknown) => new AppError("VALIDATION_ERROR", message, details);
