import { env } from "../config/env.js";
import { getRabbitMQQueueStats } from "../messaging/rabbitmq.js";
import {
    getRetryQueueName,
    retryDelaysMs
} from "../messaging/topology.js";
import {
    rabbitMQQueueConsumers,
    rabbitMQQueueMessagesReady,
    rabbitMQQueueMetricsUp
} from "./metrics.js";

type QueueDescriptor = {
    queue: string;
    kind: "main" | "retry" | "dlq";
};

const queueDescriptors: QueueDescriptor[] = [
    {
        queue: env.SYNC_MAIN_QUEUE_NAME,
        kind: "main"
    },
    ...retryDelaysMs.map((delayMs) => ({
        queue: getRetryQueueName(delayMs),
        kind: "retry" as const
    })),
    {
        queue: env.SYNC_DLQ_NAME,
        kind: "dlq"
    }
];

export async function refreshRabbitMQQueueMetrics() {
    try {
        const stats = await getRabbitMQQueueStats(
            queueDescriptors.map(({ queue }) => queue)
        );

        rabbitMQQueueMessagesReady.reset();
        rabbitMQQueueConsumers.reset();

        for (const queueStats of stats) {
            const descriptor = queueDescriptors.find(
                ({ queue }) => queue === queueStats.queue
            );

            if (!descriptor) {
                continue;
            }

            const labels = {
                queue: descriptor.queue,
                kind: descriptor.kind
            };

            rabbitMQQueueMessagesReady.set(
                labels,
                queueStats.messageCount
            );

            rabbitMQQueueConsumers.set(
                labels,
                queueStats.consumerCount
            );
        }

        rabbitMQQueueMetricsUp.set(1);
    } catch (error) {
        rabbitMQQueueMetricsUp.set(0);
        throw error;
    }
}