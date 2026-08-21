import { env } from "../../config/env.js";

type PrometheusMetric = Record<string, string>;

type PrometheusSample = {
    metric: PrometheusMetric;
    value: [number, string];
};

type PrometheusResponse = {
    status: string;
    data?: {
        resultType: string;
        result: PrometheusSample[];
    };
};

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

const serviceNames = [
    "auth-server",
    "app-a",
    "app-b",
    "sync-worker",
    "event-publisher"
] as const;

async function queryPrometheus(query: string): Promise<PrometheusSample[]> {
    const url = new URL("/api/v1/query", env.PROMETHEUS_URL);

    url.searchParams.set("query", query);

    const response = await fetch(url, {
        signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
        throw new Error(`Prometheus request failed with status ${response.status}`);
    }

    const body = await response.json() as PrometheusResponse;

    if (body.status !== "success" || !body.data || !Array.isArray(body.data.result)) {
        throw new Error("Prometheus returned an invalid response");
    }

    return body.data.result;
}

function toNumber(value: string | undefined) {
    if (value === undefined) {
        return 0;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
}

function findServiceValue(
    samples: PrometheusSample[],
    service: string
) {
    const sample = samples.find(
        ({ metric }) => metric.service === service
    );

    return toNumber(sample?.value[1]);
}

function findJobValue(
    samples: PrometheusSample[],
    job: string
) {
    const sample = samples.find(
        ({ metric }) => metric.job === job
    );

    return toNumber(sample?.value[1]);
}

export async function getObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
    const [
        serviceUp,
        requestRates,
        errorRates,
        p95Latencies,
        queueReady,
        queueConsumers,
        workerProcessed,
        workerFailed,
        workerDuration
    ] = await Promise.all([
        queryPrometheus('up{job=~"auth-server|app-a|app-b|sync-worker|event-publisher"}'),
        queryPrometheus("sum by (service) (rate(labpro_http_requests_total[1m]))"),
        queryPrometheus("100 * sum by (service) (rate(labpro_http_errors_total[1m])) / clamp_min(sum by (service) (rate(labpro_http_requests_total[1m])), 0.000001)"),
        queryPrometheus("histogram_quantile(0.95, sum by (le, service) (rate(labpro_http_request_duration_seconds_bucket[1m])))"),
        queryPrometheus("labpro_rabbitmq_queue_messages_ready"),
        queryPrometheus("labpro_rabbitmq_queue_consumers"),
        queryPrometheus("sum(labpro_sync_events_processed_total)"),
        queryPrometheus("sum(labpro_sync_events_failed_total)"),
        queryPrometheus("sum(rate(labpro_sync_worker_processing_duration_seconds_sum[1m])) / clamp_min(sum(rate(labpro_sync_worker_processing_duration_seconds_count[1m])), 0.000001)")
    ]);

    const services = serviceNames.map((service) => ({
        service,
        up: findJobValue(serviceUp, service) === 1,
        requestRate: findServiceValue(requestRates, service),
        errorRatePercent: findServiceValue(errorRates, service),
        p95LatencySeconds: findServiceValue(p95Latencies, service)
    }));

    const queues = queueReady.map((sample) => {
        const queue = sample.metric.queue ?? "unknown";
        const kind = sample.metric.kind ?? "unknown";
        const consumerSample = queueConsumers.find(
            ({ metric }) => metric.queue === queue
        );

        return {
            queue,
            kind,
            messagesReady: toNumber(sample.value[1]),
            consumers: toNumber(consumerSample?.value[1])
        };
    });

    return {
        generatedAt: new Date().toISOString(),
        services,
        queues,
        worker: {
            up: findJobValue(serviceUp, "sync-worker") === 1,
            processedTotal: toNumber(workerProcessed[0]?.value[1]),
            failedTotal: toNumber(workerFailed[0]?.value[1]),
            averageProcessingDurationSeconds: toNumber(workerDuration[0]?.value[1])
        }
    };
}