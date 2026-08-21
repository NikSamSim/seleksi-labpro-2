import { Counter, Histogram } from "prom-client";

import { metricsRegistry } from "./metrics.js";

export type SyncDeliveryMetricResult =
    | "success"
    | "http_error"
    | "timeout"
    | "network_error";

const syncEventsProcessedTotal = new Counter({
    name: "labpro_sync_events_processed_total",
    help: "Total number of sync event delivery attempts processed by the worker",
    labelNames: ["result"] as const,
    registers: [metricsRegistry]
});

const syncEventsFailedTotal = new Counter({
    name: "labpro_sync_events_failed_total",
    help: "Total number of failed sync event delivery attempts",
    labelNames: ["result"] as const,
    registers: [metricsRegistry]
});

const syncWorkerProcessingDurationSeconds = new Histogram({
    name: "labpro_sync_worker_processing_duration_seconds",
    help: "Time spent processing an internal logout delivery",
    labelNames: ["result"] as const,
    buckets: [
        0.005,
        0.01,
        0.025,
        0.05,
        0.1,
        0.25,
        0.5,
        1,
        2.5,
        5,
        10
    ],
    registers: [metricsRegistry]
});

export function recordSyncDeliveryMetrics(
    result: SyncDeliveryMetricResult,
    durationSeconds: number
) {
    syncEventsProcessedTotal.inc({
        result
    });

    syncWorkerProcessingDurationSeconds.observe(
        {
            result
        },
        durationSeconds
    );

    if (result !== "success") {
        syncEventsFailedTotal.inc({
            result
        });
    }
}