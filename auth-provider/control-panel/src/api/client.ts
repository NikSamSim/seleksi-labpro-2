import type {
    ApiErrorResponse
} from "./types";

const API_BASE_URL = (
    import.meta.env.VITE_AUTH_SERVER_URL ??
    "http://localhost:3000"
).replace(/\/+$/, "");

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null
    );
}

function isApiErrorResponse(
    value: unknown
): value is ApiErrorResponse {
    if (
        !isRecord(value) ||
        !isRecord(value.error)
    ) {
        return false;
    }

    return (
        typeof value.error.code === "string" &&
        typeof value.error.message === "string" &&
        typeof value.error.requestId === "string"
    );
}

export class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly requestId: string;

    constructor(
        status: number,
        response: ApiErrorResponse
    ) {
        super(response.error.message);

        this.name = "ApiError";
        this.status = status;
        this.code = response.error.code;
        this.requestId = response.error.requestId;
    }
}

export async function apiRequest<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
    const headers = new Headers(init.headers);

    if (
        init.body !== undefined &&
        !headers.has("Content-Type")
    ) {
        headers.set(
            "Content-Type",
            "application/json"
        );
    }

    const normalizedPath =
        path.startsWith("/")
            ? path
            : `/${path}`;

    const response = await fetch(
        `${API_BASE_URL}${normalizedPath}`,
        {
            ...init,
            headers,
            credentials:
                init.credentials ?? "include"
        }
    );

    const contentType =
        response.headers.get("content-type") ?? "";

    const payload: unknown =
        contentType.includes("application/json")
            ? await response.json()
            : null;

    if (!response.ok) {
        if (isApiErrorResponse(payload)) {
            throw new ApiError(
                response.status,
                payload
            );
        }

        throw new Error(
            `Request gagal dengan status ${response.status}`
        );
    }

    return payload as T;
}