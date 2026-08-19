import { randomBytes } from "node:crypto";

import { hashOpaqueValue } from "./token.js";

const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_BYTES = 12;

export function generateRecoveryCodes(): string[] {
    return Array.from(
        { length: RECOVERY_CODE_COUNT },
        () => randomBytes(RECOVERY_CODE_BYTES).toString("base64url")
    );
}

export function normalizeRecoveryCode(code: string): string {
    return code.trim();
}

export function hashRecoveryCode(code: string): string {
    return hashOpaqueValue(normalizeRecoveryCode(code));
}