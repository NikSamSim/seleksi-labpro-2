import {
    createHmac,
    timingSafeEqual
} from "node:crypto";
import stableStringify from "fast-json-stable-stringify";

const SIGNATURE_FRESHNESS_SECONDS = 300;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

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

export function verifyInternalSignature(
    timestamp: string,
    payload: unknown,
    signature: string,
    secret: string
): boolean {
    if (!SHA256_HEX_PATTERN.test(signature)) {
        return false;
    }

    const expectedSignature = createInternalSignature(
        timestamp,
        payload,
        secret
    );

    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function isInternalTimestampFresh(
    timestamp: string,
    nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
    if (!/^\d+$/.test(timestamp)) {
        return false;
    }

    const timestampSeconds = Number(timestamp);

    if (!Number.isSafeInteger(timestampSeconds)) {
        return false;
    }

    return Math.abs(nowSeconds - timestampSeconds) <=
        SIGNATURE_FRESHNESS_SECONDS;
}