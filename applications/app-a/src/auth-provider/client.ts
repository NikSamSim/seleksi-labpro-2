import { z } from "zod";

import { applicationConfig } from "../config/application.js";

const tokenResponseSchema = z.object({
    access_token: z.string().min(1),
    token_type: z.literal("Bearer"),
    expires_in: z.number().int().positive()
}).strict();

const userInfoResponseSchema = z.object({
    sub: z.string().uuid(),
    name: z.string().min(1),
    email: z.string().email(),
    groups: z.array(z.string()),
    centralSessionId: z.string().uuid(),
    clientId: z.string().min(1)
}).strict();

export type TokenExchangeResult = {
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
};

export type UserInfo = z.infer<typeof userInfoResponseSchema>;

type AuthProviderOperation =
    | "token_exchange"
    | "userinfo";

type AuthProviderFailureReason =
    | "request_failed"
    | "invalid_response";

export class AuthProviderClientError extends Error {
    constructor(
        public readonly operation: AuthProviderOperation,
        public readonly reason: AuthProviderFailureReason,
        public readonly upstreamStatus: number | null,
        options?: ErrorOptions
    ) {
        super("Auth Provider request failed", options);

        this.name = "AuthProviderClientError";
    }
}

export async function exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
}): Promise<TokenExchangeResult> {
    const url = new URL(
        "/token",
        applicationConfig.authServerInternalUrl
    );

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        client_id: applicationConfig.clientId,
        client_secret: applicationConfig.clientSecret,
        redirect_uri: applicationConfig.redirectUri,
        code_verifier: input.codeVerifier
    });

    let response: Response;

    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "content-type":
                    "application/x-www-form-urlencoded"
            },
            body,
            signal: AbortSignal.timeout(
                applicationConfig.authServerRequestTimeoutMs
            )
        });
    } catch (cause) {
        throw new AuthProviderClientError(
            "token_exchange",
            "request_failed",
            null,
            { cause }
        );
    }

    if (!response.ok) {
        throw new AuthProviderClientError(
            "token_exchange",
            "request_failed",
            response.status
        );
    }

    let payload: unknown;

    try {
        payload = await response.json();
    } catch (cause) {
        throw new AuthProviderClientError(
            "token_exchange",
            "invalid_response",
            response.status,
            { cause }
        );
    }

    const parsed =
        tokenResponseSchema.safeParse(payload);

    if (!parsed.success) {
        throw new AuthProviderClientError(
            "token_exchange",
            "invalid_response",
            response.status
        );
    }

    return {
        accessToken: parsed.data.access_token,
        tokenType: parsed.data.token_type,
        expiresIn: parsed.data.expires_in
    };
}

export async function fetchUserInfo(
    accessToken: string
): Promise<UserInfo> {
    const url = new URL(
        "/userinfo",
        applicationConfig.authServerInternalUrl
    );

    let response: Response;

    try {
        response = await fetch(url, {
            method: "GET",
            headers: {
                authorization: `Bearer ${accessToken}`,
                "x-client-id":
                    applicationConfig.clientId,
                "x-client-secret":
                    applicationConfig.clientSecret
            },
            signal: AbortSignal.timeout(
                applicationConfig.authServerRequestTimeoutMs
            )
        });
    } catch (cause) {
        throw new AuthProviderClientError(
            "userinfo",
            "request_failed",
            null,
            { cause }
        );
    }

    if (!response.ok) {
        throw new AuthProviderClientError(
            "userinfo",
            "request_failed",
            response.status
        );
    }

    let payload: unknown;

    try {
        payload = await response.json();
    } catch (cause) {
        throw new AuthProviderClientError(
            "userinfo",
            "invalid_response",
            response.status,
            { cause }
        );
    }

    const parsed =
        userInfoResponseSchema.safeParse(payload);

    if (!parsed.success) {
        throw new AuthProviderClientError(
            "userinfo",
            "invalid_response",
            response.status
        );
    }

    if (
        parsed.data.clientId !==
        applicationConfig.clientId
    ) {
        throw new AuthProviderClientError(
            "userinfo",
            "invalid_response",
            response.status
        );
    }

    return parsed.data;
}