import dotenv from "dotenv";
dotenv.config();

const config = {
    mongodb: {
        uri: process.env.MONGODB_URI,
        connection: process.env.DB_CONNECTION,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        name: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD
    },
    server: {
        port: process.env.PORT
    },
    route: {
        prefix: "/api/v1"
    },
    auth: {
        secret: process.env.SECRET_KEY,
        expiresIn: process.env.EXPIRES_IN
    },
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
    },
    mail: {
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT) || 587,
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS || process.env.MAILL_PASS,
    },
    client: {
        url: process.env.CLIENT_URL || "http://localhost:5173",
    }


}

export default config;