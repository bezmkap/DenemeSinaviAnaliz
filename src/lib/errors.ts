export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  MODULE_DISABLED: "MODULE_DISABLED",
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  AYT_NOT_READY: "AYT_NOT_READY",
  DUPLICATE_UPLOAD: "DUPLICATE_UPLOAD",
  CONFLICT: "CONFLICT",
} as const;
