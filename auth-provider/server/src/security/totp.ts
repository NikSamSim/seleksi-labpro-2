import * as OTPAuth from "otpauth";

import { env } from "../config/env.js";

const TOTP_ALGORITHM = "SHA1";
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;
const TOTP_SECRET_SIZE_BYTES = 20;

export function generateTotpSecret(): string {
    return new OTPAuth.Secret({
        size: TOTP_SECRET_SIZE_BYTES
    }).base32;
}

export function createTotpUri(
    accountLabel: string,
    secretBase32: string
): string {
    const totp = new OTPAuth.TOTP({
        issuer: env.MFA_ISSUER,
        label: accountLabel,
        algorithm: TOTP_ALGORITHM,
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD_SECONDS,
        secret: OTPAuth.Secret.fromBase32(secretBase32)
    });

    return totp.toString();
}

export function verifyTotpCode(
    secretBase32: string,
    code: string
): boolean {
    if (!/^\d{6}$/.test(code)) {
        return false;
    }

    const delta = OTPAuth.TOTP.validate({
        token: code,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
        algorithm: TOTP_ALGORITHM,
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD_SECONDS,
        window: TOTP_WINDOW
    });

    return delta !== null;
}