import amqp, {
    type ChannelModel,
    type ConfirmChannel
} from "amqplib";

import { env } from "../config/env.js";

import { assertSyncTopology } from "./topology.js";

let connection: ChannelModel | null = null;
let publisherConfirmChannel: ConfirmChannel | null = null;

export type RabbitMQQueueStats = {
    queue: string;
    messageCount: number;
    consumerCount: number;
};

export async function connectRabbitMQ() {
    if (connection) {
        return connection;
    }

    const newConnection = await amqp.connect(env.RABBITMQ_URL);

    newConnection.on("close", () => {
        if (connection === newConnection) {
            connection = null;
            publisherConfirmChannel = null;
        }
    });

    newConnection.on("error", () => {
        // The close event will reset the connection state.
    });

    connection = newConnection;

    return connection;
}

export async function getPublisherConfirmChannel() {
    if (publisherConfirmChannel) {
        return publisherConfirmChannel;
    }

    const currentConnection = await connectRabbitMQ();
    const channel = await currentConnection.createConfirmChannel();

    channel.on("close", () => {
        if (publisherConfirmChannel === channel) {
            publisherConfirmChannel = null;
        }
    });

    channel.on("error", () => {
        // The close event will reset the channel state.
    });

    publisherConfirmChannel = channel;

    return publisherConfirmChannel;
}

export async function setupRabbitMQTopology() {
    const channel = await getPublisherConfirmChannel();

    await assertSyncTopology(channel);
}

export async function checkRabbitMQ() {
    const currentConnection = await connectRabbitMQ();

    const channel = await currentConnection.createChannel();
    await channel.close();
}

export async function getRabbitMQQueueStats(
    queueNames: string[]
): Promise<RabbitMQQueueStats[]> {
    const currentConnection = await connectRabbitMQ();
    const channel = await currentConnection.createChannel();

    try {
        const result: RabbitMQQueueStats[] = [];

        for (const queueName of queueNames) {
            const queue = await channel.checkQueue(queueName);

            result.push({
                queue: queueName,
                messageCount: queue.messageCount,
                consumerCount: queue.consumerCount
            });
        }

        return result;
    } finally {
        try {
            await channel.close();
        } catch {
            // Channel may already be closed.
        }
    }
}

export async function disconnectRabbitMQ() {
    const currentChannel = publisherConfirmChannel;
    publisherConfirmChannel = null;

    if (currentChannel) {
        try {
            await currentChannel.close();
        } catch {
            // The channel may already be closed because the connection was lost.
        }
    }

    const currentConnection = connection;
    connection = null;

    if (currentConnection) {
        try {
            await currentConnection.close();
        } catch {
            // The connection may already be closed.
        }
    }
}