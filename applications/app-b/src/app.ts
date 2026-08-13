import Fastify from "fastify";

export function buildApp() {
    const app = Fastify({
        logger: true
    });

    app.get("/health/live", async () => {
        return {
            status: "alive"
        };
    });

    app.get("/health/ready", async () => {
        return {
            status: "ready"
        };
    });

    return app;
}