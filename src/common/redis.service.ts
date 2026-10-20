// d:\chat_real_time\open_chat\src\common\redis.service.ts
import redisClient from "../config/connectRedis.js";

export const redisService = {
    // 1. Lưu Refresh Token (Mặc định 7 ngày = 604800 giây)
    setRefreshToken: async (userId: string, token: string, ttlSeconds = 604800) => {
        const key = `refresh_token:${userId}`;
        return await redisClient.setex(key, ttlSeconds, token);
    },

    // 2. Lấy Refresh Token
    getRefreshToken: async (userId: string) => {
        const key = `refresh_token:${userId}`;
        return await redisClient.get(key);
    },

    // 3. Xóa Refresh Token (khi Logout)
    removeRefreshToken: async (userId: string) => {
        const key = `refresh_token:${userId}`;
        return await redisClient.del(key);
    },

    // 4. Cache thông tin User Profile (Mặc định 1 ngày)
    setUserCache: async (userId: string, user: any, ttlSeconds = 24 * 3600) => {
        const key = `user:profile:${userId}`;
        return await redisClient.setex(key, ttlSeconds, JSON.stringify(user));
    },

    // 5. Lấy User Profile từ Cache
    getUserCache: async (userId: string) => {
        const key = `user:profile:${userId}`;
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    },

    // 6. Xóa User Cache (khi user update profile)
    removeUserCache: async (userId: string) => {
        const key = `user:profile:${userId}`;
        return await redisClient.del(key);
    },

    // 7. Lưu key redis
    setKeyCache: async (userId: string, user: any, key: string, ttlSeconds = 24 * 3600) => {
        const keyR = `user:${userId}:${key}`;
        return await redisClient.setex(keyR, ttlSeconds, JSON.stringify(user));
    },

    // 8. Lấy key redis
    getKeyCache: async (userId: string, key: string) => {
        const keyR = `user:${userId}:${key}`;
        return await redisClient.get(keyR);
    },
};
