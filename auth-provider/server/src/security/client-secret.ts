import { timingSafeEqual } from "node:crypto";

import {
    generateOpaqueValue,
    hashOpaqueValue
} from "./token.js";

export function generateClientSecret(): string {
    return generateOpaqueValue();
}

export function hashClientSecret(clientSecret: string): string {
    return hashOpaqueValue(clientSecret);
}

export function verifyClientSecret(
    clientSecretHash: string,
    clientSecret: string
): boolean {
    const actualHash = hashClientSecret(clientSecret);

    const actualBuffer = Buffer.from(actualHash, "utf8");
    const expectedBuffer = Buffer.from(clientSecretHash, "utf8");

    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
}