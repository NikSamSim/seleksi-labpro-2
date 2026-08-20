import { createHmac } from "node:crypto";
import stableStringify from "fast-json-stable-stringify";

function createCanonicalMessage(
    timestamp: string,
    payload: unknown
): string {
    return `${timestamp}.${stableStringify(payload)}`;
}

export function createInternalSignature(
    timestamp: string,
    payload: unknown,
    secret: string
): string {
    return createHmac("sha256", secret)
        .update(createCanonicalMessage(timestamp, payload), "utf8")
        .digest("hex");
}