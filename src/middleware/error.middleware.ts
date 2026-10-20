// d:\chat_real_time\open_chat\src\middleware\error.middleware.ts
import type { Request, Response, NextFunction } from "express";
import logger from "../config/logger.js";

export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // 1. Bắt lỗi trùng lặp dữ liệu của MongoDB (Unique key)
    if (err.code === 11000 && err.keyValue) {
        const keys = Object.keys(err.keyValue);
        const field = keys[0];
        if (field) {
            message = `${field} '${err.keyValue[field]}' đã tồn tại trong hệ thống!`;
        } else {
            message = "Dữ liệu đã tồn tại trong hệ thống!";
        }
        statusCode = 400;
    }


    // 2. Bắt lỗi JWT không hợp lệ hoặc hết hạn
    if (err.name === "JsonWebTokenError") {
        message = "Token không hợp lệ, vui lòng đăng nhập lại!";
        statusCode = 401;
    }
    if (err.name === "TokenExpiredError") {
        message = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!";
        statusCode = 401;
    }

    // Ghi log lỗi ra console / file
    logger.error(`[${req.method}] ${req.originalUrl} - ${statusCode}: ${message}`);

    // Trả về JSON lỗi đồng nhất cho FE
    return res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        // Khi ở môi trường development thì hiện thêm stack trace để dễ debug
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
};
