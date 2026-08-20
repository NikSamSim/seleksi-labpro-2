import amqp, {
    type Channel,
    type ChannelModel,
    type ConfirmChannel
} from "amqplib";

import { env } from "../config/env.js";

import { assertSyncTopology } from "./topology.js";

let connection: ChannelModel | null = null;
let consumerChannel: Channel | null = null;
let publisherConfirmChannel: ConfirmChannel | null = null;

export async function connectRabbitMQ() {
    if (connection) {
        return connection;
    }

    connection = await amqp.connect(env.RABBITMQ_URL);

    connection.on("close", () => {
        connection = null;
        consumerChannel = null;
        publisherConfirmChannel = null;
    });

    connection.on("error", () => {
        // The close event will reset the connection state.
    });

    return connection;
}

export async function setupRabbitMQTopology() {
    const currentConnection = await connectRabbitMQ();
    const channel = await currentConnection.createChannel();

    try {
        await assertSyncTopology(channel);
    } finally {
        await channel.close();
    }
}

export async function checkRabbitMQ() {
    const currentConnection = await connectRabbitMQ();

    const channel = await currentConnection.createChannel();
    await channel.close();
}

export async function disconnectRabbitMQ() {
    await closeConsumerChannel();

    const currentPublisherConfirmChannel = publisherConfirmChannel;
    publisherConfirmChannel = null;

    if (currentPublisherConfirmChannel) {
        try {
            await currentPublisherConfirmChannel.close();
        } catch {
            // Channel may already be closed.
        }
    }

    const currentConnection = connection;
    connection = null;

    if (currentConnection) {
        try {
            await currentConnection.close();
        } catch {
            // Connection may already be closed.
        }
    }
}

export async function getConsumerChannel() {
    if (consumerChannel) {
        return consumerChannel;
    }

    const currentConnection =
        await connectRabbitMQ();

    const channel =
        await currentConnection.createChannel();

    await channel.prefetch(
        env.SYNC_WORKER_PREFETCH
    );

    channel.on("close", () => {
        if (consumerChannel === channel) {
            consumerChannel = null;
        }
    });

    channel.on("error", () => {
        // The close event will reset the channel state.
    });

    consumerChannel = channel;

    return consumerChannel;
}

export async function getPublisherConfirmChannel() {
    if (publisherConfirmChannel) {
        return publisherConfirmChannel;
    }

    const currentConnection =
        await connectRabbitMQ();

    const channel =
        await currentConnection.createConfirmChannel();

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

export async function closeConsumerChannel() {
    const currentConsumerChannel =
        consumerChannel;

    consumerChannel = null;

    if (!currentConsumerChannel) {
        return;
    }

    try {
        await currentConsumerChannel.close();
    } catch {
        // Channel may already be closed.
    }
}