const { createClient } = require("redis");

// Redis client options (customize for production)
const REDIS_OPTIONS = {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 2000), // Exponential backoff
    },
};

// Initialize Redis clients
const publisher = createClient(REDIS_OPTIONS);
const subscriber = createClient(REDIS_OPTIONS);

// Connect Redis clients with retries and logging
const connectRedis = async (client, clientName) => {
    client.on("error", (error) => {
        console.error(`[${clientName}] Redis error:`, error);
    });

    client.on("connect", () => {
        console.log(`[${clientName}] Redis connected successfully.`);
    });

    client.on("reconnecting", () => {
        console.log(`[${clientName}] Redis reconnecting...`);
    });

    client.on("ready", () => {
        console.log(`[${clientName}] Redis is ready for operations.`);
    });

    try {
        await client.connect();
    } catch (error) {
        console.error(`[${clientName}] Redis connection failed:`, error);
    }
};

// Connect publisher and subscriber
connectRedis(publisher, "Publisher");
connectRedis(subscriber, "Subscriber");

/**
 * Publish a message to a Redis channel
 * @param {string} channel - The Redis channel name
 * @param {object} message - The message object to send
 */
const publishMessage = async (channel, message) => {
    try {
        await publisher.publish(channel, JSON.stringify(message));
        console.log(`[Publisher] Message published to channel ${channel}:`, message);
    } catch (error) {
        console.error(`[Publisher] Error publishing message to channel ${channel}:`, error);
    }
};

/**
 * Subscribe to a Redis channel
 * @param {string} channel - The Redis channel name
 * @param {function} callback - Function to process incoming messages
 */
const subscribeToChannel = async (channel, callback) => {
    try {
        await subscriber.subscribe(channel, (message) => {
            console.log(`[Subscriber] Message received on channel ${channel}:`, message);
            if (callback) callback(JSON.parse(message));
        });
        console.log(`[Subscriber] Subscribed to channel: ${channel}`);
    } catch (error) {
        console.error(`[Subscriber] Error subscribing to channel ${channel}:`, error);
    }
};

/**
 * Unsubscribe from a Redis channel
 * @param {string} channel - The Redis channel name
 */
const unsubscribeFromChannel = async (channel) => {
    try {
        await subscriber.unsubscribe(channel);
        console.log(`[Subscriber] Unsubscribed from channel: ${channel}`);
    } catch (error) {
        console.error(`[Subscriber] Error unsubscribing from channel ${channel}:`, error);
    }
};

/**
 * Gracefully shutdown Redis clients
 */
const shutdownRedis = async () => {
    try {
        await publisher.quit();
        console.log("[Publisher] Redis client shut down successfully.");

        await subscriber.quit();
        console.log("[Subscriber] Redis client shut down successfully.");
    } catch (error) {
        console.error("Error shutting down Redis clients:", error);
    }
};

// Graceful shutdown on process exit
process.on("SIGINT", shutdownRedis);
process.on("SIGTERM", shutdownRedis);

module.exports = {
    publishMessage,
    subscribeToChannel,
    unsubscribeFromChannel,
    shutdownRedis,
};
