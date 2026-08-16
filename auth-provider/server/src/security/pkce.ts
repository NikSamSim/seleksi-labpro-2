import { createHash, timingSafeEqual } from "node:crypto";

export function createPkceChallenge(codeVerifier: string): string {
    return createHash("sha256")
        .update(codeVerifier, "utf8")
        .digest("base64url");
}

export function verifyPkceChallenge(
    codeVerifier: string,
    expectedChallenge: string
): boolean {
    const actualChallenge = createPkceChallenge(codeVerifier);

    const actualBuffer = Buffer.from(actualChallenge, "utf8");
    const expectedBuffer = Buffer.from(expectedChallenge, "utf8");

    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
}