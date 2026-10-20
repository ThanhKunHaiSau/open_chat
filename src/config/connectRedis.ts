// d:\chat_real_time\open_chat\src\config\connectRedis.ts
import { Redis } from "ioredis";
import config from "./index.js";
import logger from "./logger.js";

const redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
    }
});

redisClient.on("connect", () => {
    logger.info("Redis connected successfully!");
});

redisClient.on("error", (err) => {
    logger.error(`Redis connection error: ${err}`);
});

export default redisClient;
