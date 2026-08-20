import { env } from "./env.js";

export const applicationConfig = {
    name: "App B",
    nodeEnv: env.NODE_ENV,

    clientId: env.APP_B_CLIENT_ID,
    clientSecret: env.APP_B_CLIENT_SECRET,
    redirectUri: env.APP_B_REDIRECT_URI,

    cookieName: env.APP_B_COOKIE_NAME,
    sessionTtlSeconds: env.APP_B_SESSION_TTL_SECONDS,
    oauthTransactionTtlSeconds: env.APP_B_OAUTH_TRANSACTION_TTL_SECONDS,

    authServerPublicUrl: env.AUTH_SERVER_PUBLIC_URL,
    authServerInternalUrl: env.AUTH_SERVER_INTERNAL_URL,
    authServerRequestTimeoutMs: env.AUTH_SERVER_REQUEST_TIMEOUT_MS,

    internalLogoutSecret: env.APP_B_INTERNAL_LOGOUT_SECRET
} as const;