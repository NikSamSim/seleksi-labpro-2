import type {
    FastifyInstance
} from "fastify";

import { env } from "../../config/env.js";

import { applicationRoutes } from "../applications/routes.js";
import {
    groupRoutes,
    membershipRoutes
} from "../groups/routes.js";
import { observabilityRoutes } from "../observability/routes.js";
import { policyRoutes } from "../policies/routes.js";
import { userRoutes } from "../users/routes.js";

import {
    requireAdmin,
    type AdminPrincipal
} from "./service.js";

declare module "fastify" {
    interface FastifyRequest {
        admin: AdminPrincipal | null;
    }
}

export async function adminRoutes(
    app: FastifyInstance
) {
    app.decorateRequest(
        "admin",
        null
    );

    app.addHook(
        "preHandler",
        async (request) => {
            const rawToken =
                request.cookies[
                    env.SSO_COOKIE_NAME
                ];

            request.admin =
                await requireAdmin(rawToken);
        }
    );

    app.get("/me", async (request) => {
        const admin = request.admin!;

        return {
            user: {
                id: admin.userId,
                name: admin.name,
                email: admin.email
            },
            session: {
                id: admin.sessionId
            }
        };
    });

    app.register(userRoutes, {
        prefix: "/users"
    });

    app.register(groupRoutes, {
        prefix: "/groups"
    });

    app.register(membershipRoutes, {
        prefix: "/users"
    });

    app.register(applicationRoutes, {
        prefix: "/applications"
    });

    app.register(policyRoutes, {
        prefix: "/applications"
    });

    app.register(observabilityRoutes, {
        prefix: "/observability"
    });
}