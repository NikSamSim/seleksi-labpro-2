import type {
    FastifyInstance,
    FastifyReply
} from "fastify";

import { applicationConfig } from "../../config/application.js";
import {
    isInternalTimestampFresh,
    verifyInternalSignature
} from "../../security/internal-signature.js";
import { writeActivity } from "../activity/service.js";
import {
    internalLogoutEventSchema,
    internalLogoutHeadersSchema
} from "./schemas.js";
import { processInternalLogout } from "./service.js";

function sendInternalError(
    reply: FastifyReply,
    input: {
        statusCode: number;
        code: string;
        message: string;
        requestId: string;
    }
) {
    return reply
        .code(input.statusCode)
        .send({
            error: {
                code: input.code,
                message: input.message,
                requestId: input.requestId
            }
        });
}

export function registerInternalLogoutRoutes(
    app: FastifyInstance
) {
    app.post(
        "/internal/logout",
        async (request, reply) => {
            const headers =
                internalLogoutHeadersSchema.safeParse(
                    request.headers
                );

            if (!headers.success) {
                return sendInternalError(reply, {
                    statusCode: 401,
                    code: "UNAUTHORIZED",
                    message:
                        "Internal request tidak valid",
                    requestId: request.id
                });
            }

            const payload =
                internalLogoutEventSchema.safeParse(
                    request.body
                );

            if (!payload.success) {
                return sendInternalError(reply, {
                    statusCode: 400,
                    code: "INVALID_EVENT",
                    message:
                        "Event payload tidak valid",
                    requestId: request.id
                });
            }

            const event = payload.data;
            const eventId =
                headers.data["x-event-id"];
            const timestamp =
                headers.data["x-timestamp"];
            const signature =
                headers.data["x-signature"];

            if (eventId !== event.eventId) {
                return sendInternalError(reply, {
                    statusCode: 401,
                    code: "UNAUTHORIZED",
                    message:
                        "Internal request tidak valid",
                    requestId: request.id
                });
            }

            if (
                !isInternalTimestampFresh(
                    timestamp
                )
            ) {
                return sendInternalError(reply, {
                    statusCode: 401,
                    code: "UNAUTHORIZED",
                    message:
                        "Internal request tidak valid",
                    requestId: request.id
                });
            }

            if (
                !verifyInternalSignature(
                    timestamp,
                    event,
                    signature,
                    applicationConfig.internalLogoutSecret
                )
            ) {
                return sendInternalError(reply, {
                    statusCode: 401,
                    code: "UNAUTHORIZED",
                    message:
                        "Internal request tidak valid",
                    requestId: request.id
                });
            }

            try {
                const result =
                    await processInternalLogout(
                        event,
                        request.id
                    );

                if (result.duplicate) {
                    try {
                        await writeActivity({
                            eventType:
                                "internal_logout_duplicate",
                            message:
                                "Duplicate internal logout event ignored",
                            externalUserId:
                                event.userId,
                            requestId:
                                request.id,
                            metadata: {
                                eventId:
                                    event.eventId,
                                eventType:
                                    event.eventType
                            }
                        });
                    } catch {
                        request.log.warn(
                            {
                                eventId:
                                    event.eventId
                            },
                            "Failed to write duplicate event activity"
                        );
                    }

                    return reply.send({
                        success: true,
                        duplicate: true
                    });
                }

                return reply.send({
                    success: true,
                    duplicate: false,
                    revokedSessions:
                        result.revokedSessions
                });
            } catch {
                request.log.error(
                    {
                        eventId:
                            event.eventId,
                        eventType:
                            event.eventType
                    },
                    "Internal logout processing failed"
                );

                return sendInternalError(reply, {
                    statusCode: 500,
                    code:
                        "INTERNAL_PROCESSING_ERROR",
                    message:
                        "Event tidak dapat diproses",
                    requestId: request.id
                });
            }
        }
    );
}