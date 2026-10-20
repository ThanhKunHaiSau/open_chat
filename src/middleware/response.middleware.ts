import express from "express";
import type { Request, Response, NextFunction } from "express";

// Mở rộng kiểu dữ liệu Response của Express trong TypeScript
declare global {
    namespace Express {
        interface Response {
            success<T = any>(data?: T, message?: string, statusCode?: number): Response;
        }
    }
}

// Gắn trực tiếp hàm success vào prototype của Express Response
(express.response as any).success = function <T = any>(
    this: Response,
    data?: T,
    message = "Success",
    statusCode = 200
) {
    return this.status(statusCode).json({
        success: true,
        statusCode,
        message,
        data: data ?? null,
    });
};

/**
 * Middleware cho Express
 */
export const responseMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Đảm bảo instance res cũng có hàm success
    if (!res.success) {
        res.success = function <T = any>(data?: T, message = "Success", statusCode = 200) {
            return res.status(statusCode).json({
                success: true,
                statusCode,
                message,
                data: data ?? null,
            });
        };
    }
    next();
};

export default responseMiddleware;
