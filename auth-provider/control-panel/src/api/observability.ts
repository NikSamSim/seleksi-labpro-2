import { apiRequest } from "./client";

export type ObservabilityService = {
    service: string;
    up: boolean;
    requestRate: number;
    errorRatePercent: number;
    p95LatencySeconds: number;
};

export type ObservabilityQueue = {
    queue: string;
    kind: string;
    messagesReady: number;
    consumers: number;
};

export type ObservabilityWorker = {
    up: boolean;
    processedTotal: number;
    failedTotal: number;
    averageProcessingDurationSeconds: number;
};

export type ObservabilitySnapshot = {
    generatedAt: string;
    services: ObservabilityService[];
    queues: ObservabilityQueue[];
    worker: ObservabilityWorker;
};

export async function getObservabilitySnapshot() {
    return apiRequest<ObservabilitySnapshot>(
        "/admin/observability"
    );
}