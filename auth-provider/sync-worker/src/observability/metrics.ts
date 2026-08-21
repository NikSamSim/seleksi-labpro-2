import type { FastifyInstance, FastifyRequest } from "fastify";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({
    service: "sync-worker"
});

collectDefaultMetrics({
    register: metricsRegistry,
    prefix: "labpro_"
});

const httpRequestsTotal = new Counter({
    name: "labpro_http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [metricsRegistry]
});

const httpErrorsTotal = new Counter({
    name: "labpro_http_errors_total",
    help: "Total number of HTTP requests resulting in 4xx or 5xx responses",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [metricsRegistry]
});

const httpRequestDurationSeconds = new Histogram({
    name: "labpro_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [metricsRegistry]
});

const requestStartTimes = new WeakMap<FastifyRequest, bigint>();

function shouldObserveRoute(route: string) {
    return route !== "/metrics" && route !== "/health/live" && route !== "/health/ready";
}

export function registerHttpMetrics(app: FastifyInstance) {
    app.addHook("onRequest", async (request) => {
        requestStartTimes.set(request, process.hrtime.bigint());
    });

    app.addHook("onResponse", async (request, reply) => {
        const route = request.routeOptions.url ?? "__unmatched__";

        if (!shouldObserveRoute(route)) {
            return;
        }

        const startTime = requestStartTimes.get(request);

        if (startTime === undefined) {
            return;
        }

        const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
        const labels = {
            method: request.method,
            route,
            status_code: String(reply.statusCode)
        };

        httpRequestsTotal.inc(labels);
        httpRequestDurationSeconds.observe(labels, durationSeconds);

        if (reply.statusCode >= 400) {
            httpErrorsTotal.inc(labels);
        }
    });
}