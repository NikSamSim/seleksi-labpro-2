import amqp, { type ChannelModel } from "amqplib";

import { env } from "../config/env.js";

import { assertSyncTopology } from "./topology.js";

let connection: ChannelModel | null = null;

export async function connectRabbitMQ() {
    if (connection) {
        return connection;
    }

    connection = await amqp.connect(env.RABBITMQ_URL);

    connection.on("close", () => {
        connection = null;
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
    if (!connection) {
        return;
    }

    await connection.close();
    connection = null;
}