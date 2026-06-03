import { createClient } from 'redis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = createClient({
    url: redisUrl
});

// Suppress errors to prevent app crashes if Redis is down or not installed locally
redisClient.on('error', (err) => {
    // Silently ignore errors so the app falls back to normal database/API calls
});

export const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('Redis Connected Successfully');
    } catch (error) {
        console.log('Redis connection failed. Caching will be bypassed gracefully.', error.message);
    }
};

export default redisClient;