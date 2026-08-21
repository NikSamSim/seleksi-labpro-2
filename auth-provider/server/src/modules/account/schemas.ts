import { z } from "zod";

export const changeOwnPasswordBodySchema =
    z.object({
        currentPassword: z
            .string()
            .min(1),

        newPassword: z
            .string()
            .min(1),

        confirmNewPassword: z
            .string()
            .min(1)
    })
        .strict()
        .refine(
            (input) =>
                input.newPassword ===
                input.confirmNewPassword,
            {
                message:
                    "Konfirmasi password baru tidak cocok",
                path: [
                    "confirmNewPassword"
                ]
            }
        )
        .refine(
            (input) =>
                input.currentPassword !==
                input.newPassword,
            {
                message:
                    "Password baru harus berbeda dari password saat ini",
                path: [
                    "newPassword"
                ]
            }
        );

export type ChangeOwnPasswordInput =
    z.infer<
        typeof changeOwnPasswordBodySchema
    >;