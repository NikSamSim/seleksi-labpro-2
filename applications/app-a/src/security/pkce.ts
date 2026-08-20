import { createHash, randomBytes } from "node:crypto";

const CODE_VERIFIER_BYTES = 32;

export function generateCodeVerifier(): string {
    return randomBytes(CODE_VERIFIER_BYTES).toString("base64url");
}

export function createCodeChallenge(codeVerifier: string): string {
    return createHash("sha256")
        .update(codeVerifier, "utf8")
        .digest("base64url");
}