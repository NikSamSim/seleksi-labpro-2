import { createHash, randomBytes } from "node:crypto";

const OPAQUE_VALUE_BYTES = 32;

export function generateOpaqueValue(): string {
    return randomBytes(OPAQUE_VALUE_BYTES).toString("base64url");
}

export function hashOpaqueValue(value: string): string {
    return createHash("sha256")
        .update(value, "utf8")
        .digest("hex");
}