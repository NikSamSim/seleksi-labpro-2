import {
    createCipheriv,
    createDecipheriv,
    randomBytes
} from "node:crypto";

import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

const encryptionKey = Buffer.from(
    env.MFA_ENCRYPTION_KEY_BASE64,
    "base64"
);

export type EncryptedValue = {
    ciphertext: string;
    iv: string;
    authTag: string;
};

export function encryptValue(value: string): EncryptedValue {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(
        ALGORITHM,
        encryptionKey,
        iv
    );

    const ciphertext = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
        ciphertext: ciphertext.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64")
    };
}

export function decryptValue(
    encryptedValue: EncryptedValue
): string {
    const decipher = createDecipheriv(
        ALGORITHM,
        encryptionKey,
        Buffer.from(encryptedValue.iv, "base64")
    );

    decipher.setAuthTag(
        Buffer.from(encryptedValue.authTag, "base64")
    );

    const plaintext = Buffer.concat([
        decipher.update(
            Buffer.from(encryptedValue.ciphertext, "base64")
        ),
        decipher.final()
    ]);

    return plaintext.toString("utf8");
}