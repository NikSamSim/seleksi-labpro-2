import {
    useCallback,
    useEffect,
    useState
} from "react";

import {
    getObservabilitySnapshot,
    type ObservabilitySnapshot
} from "../api/observability";

const REFRESH_INTERVAL_MS = 2000;

function formatRequestRate(value: number) {
    return `${value.toFixed(2)} req/s`;
}

function formatPercent(value: number) {
    return `${value.toFixed(2)}%`;
}

function formatMilliseconds(seconds: number) {
    return `${(seconds * 1000).toFixed(2)} ms`;
}

function formatServiceName(service: string) {
    switch (service) {
        case "auth-server":
            return "Auth Server";
        case "app-a":
            return "App A";
        case "app-b":
            return "App B";
        case "sync-worker":
            return "Sync Worker";
        case "event-publisher":
            return "Event Publisher";
        default:
            return service;
    }
}

export function ObservabilityPage() {
    const [snapshot, setSnapshot] =
        useState<ObservabilitySnapshot | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const loadSnapshot = useCallback(
        async (showLoading: boolean) => {
            if (showLoading) {
                setLoading(true);
            }

            try {
                const result =
                    await getObservabilitySnapshot();

                setSnapshot(result);
                setError(null);
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil metrics"
                );
            } finally {
                if (showLoading) {
                    setLoading(false);
                }
            }
        },
        []
    );

    useEffect(() => {
        let cancelled = false;

        async function initialLoad() {
            setLoading(true);

            try {
                const result =
                    await getObservabilitySnapshot();

                if (cancelled) {
                    return;
                }

                setSnapshot(result);
                setError(null);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setError(
                    error instanceof Error
                        ? error.message
                        : "Gagal mengambil metrics"
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void initialLoad();

        const interval = window.setInterval(
            () => {
                if (!cancelled) {
                    void loadSnapshot(false);
                }
            },
            REFRESH_INTERVAL_MS
        );

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [loadSnapshot]);

    if (loading && !snapshot) {
        return (
            <section>
                <h3>Observability</h3>
                <p>Memuat metrics...</p>
            </section>
        );
    }

    return (
        <section>
            <h3>Observability</h3>

            <p>
                Auto refresh setiap 2 detik.{" "}
                <button
                    type="button"
                    onClick={() =>
                        void loadSnapshot(true)
                    }
                    disabled={loading}
                >
                    {loading
                        ? "Refreshing..."
                        : "Refresh"}
                </button>
            </p>

            {snapshot && (
                <p>
                    Last updated:{" "}
                    {new Date(
                        snapshot.generatedAt
                    ).toLocaleString()}
                </p>
            )}

            {error && (
                <p>
                    Gagal memuat metrics:{" "}
                    {error}
                </p>
            )}

            {snapshot && (
                <>
                    <section>
                        <h4>Services</h4>

                        <table>
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Status</th>
                                    <th>Request Rate</th>
                                    <th>Error Rate</th>
                                    <th>P95 Latency</th>
                                </tr>
                            </thead>

                            <tbody>
                                {snapshot.services.map(
                                    (service) => (
                                        <tr
                                            key={
                                                service.service
                                            }
                                        >
                                            <td>
                                                {formatServiceName(
                                                    service.service
                                                )}
                                            </td>

                                            <td>
                                                {service.up
                                                    ? "UP"
                                                    : "DOWN"}
                                            </td>

                                            <td>
                                                {formatRequestRate(
                                                    service.requestRate
                                                )}
                                            </td>

                                            <td>
                                                {formatPercent(
                                                    service.errorRatePercent
                                                )}
                                            </td>

                                            <td>
                                                {formatMilliseconds(
                                                    service.p95LatencySeconds
                                                )}
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </section>

                    <section>
                        <h4>RabbitMQ Queues</h4>

                        <table>
                            <thead>
                                <tr>
                                    <th>Queue</th>
                                    <th>Type</th>
                                    <th>Messages Ready</th>
                                    <th>Consumers</th>
                                </tr>
                            </thead>

                            <tbody>
                                {snapshot.queues.map(
                                    (queue) => (
                                        <tr
                                            key={
                                                queue.queue
                                            }
                                        >
                                            <td>
                                                {queue.queue}
                                            </td>

                                            <td>
                                                {queue.kind}
                                            </td>

                                            <td>
                                                {
                                                    queue.messagesReady
                                                }
                                            </td>

                                            <td>
                                                {
                                                    queue.consumers
                                                }
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </section>

                    <section>
                        <h4>Sync Worker</h4>

                        <table>
                            <tbody>
                                <tr>
                                    <th>Status</th>
                                    <td>
                                        {snapshot.worker.up
                                            ? "UP"
                                            : "DOWN"}
                                    </td>
                                </tr>

                                <tr>
                                    <th>
                                        Processed Attempts
                                    </th>
                                    <td>
                                        {
                                            snapshot.worker
                                                .processedTotal
                                        }
                                    </td>
                                </tr>

                                <tr>
                                    <th>
                                        Failed Attempts
                                    </th>
                                    <td>
                                        {
                                            snapshot.worker
                                                .failedTotal
                                        }
                                    </td>
                                </tr>

                                <tr>
                                    <th>
                                        Average Processing Duration
                                    </th>
                                    <td>
                                        {formatMilliseconds(
                                            snapshot.worker
                                                .averageProcessingDurationSeconds
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </section>
                </>
            )}
        </section>
    );
}