export const errorCodes = [
    "VALIDATION_ERROR",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "INVALID_REQUEST",
    "INVALID_CLIENT",
    "INVALID_GRANT",
    "ACCESS_DENIED",
    "INTERNAL_ERROR"
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: ErrorCode,
        message: string
    ) {
        super(message);
        this.name = "AppError";
    }
}

export function createErrorResponse(
    code: ErrorCode,
    message: string,
    requestId: string
) {
    return {
        error: {
            code,
            message,
            requestId
        }
    };
}