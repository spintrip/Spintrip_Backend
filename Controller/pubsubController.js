const { createClient } = require('redis');

// Initialize Redis clients for publisher and subscriber
const publisher = createClient({ url: 'redis://localhost:6379' }); // Update with your Redis URL
const subscriber = createClient({ url: 'redis://localhost:6379' });

// Connect Redis clients
const connectRedis = async () => {
    try {
        await publisher.connect();
        await subscriber.connect();
        console.log('Redis Pub/Sub connected successfully.');
    } catch (error) {
        console.error('Error connecting to Redis:', error);
    }
};

connectRedis();

// Publish a message
const publishMessage = async (channel, message) => {
    try {
        await publisher.publish(channel, JSON.stringify(message));
        console.log(`Message published to channel ${channel}:`, message);
    } catch (error) {
        console.error(`Error publishing message to channel ${channel}:`, error);
    }
};

// Subscribe to a channel
const subscribeToChannel = async (channel, callback) => {
    try {
        await subscriber.subscribe(channel, (message) => {
            console.log(`Message received on channel ${channel}:`, message);
            if (callback) callback(JSON.parse(message));
        });
        console.log(`Subscribed to channel: ${channel}`);
    } catch (error) {
        console.error(`Error subscribing to channel ${channel}:`, error);
    }
};

module.exports = {
    publishMessage,
    subscribeToChannel,
};
