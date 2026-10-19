import winston from "winston";

const { combine, timestamp, printf, colorize } = winston.format;

// Định dạng hiển thị log
const customFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp}] [${level}]: ${message}`;
});

const logger = winston.createLogger({
    level: "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        customFormat
    ),
    transports: [
        // 1. In ra màn hình console có màu sắc
        new winston.transports.Console({
            format: combine(colorize(), customFormat)
        }),
        // 2. Tự động lưu lỗi vào file logs/error.log
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        // 3. Lưu toàn bộ log vào file logs/combined.log
        new winston.transports.File({ filename: "logs/combined.log" })
    ]
});

export default logger;
