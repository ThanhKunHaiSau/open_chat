// d:\chat_real_time\open_chat\src\common\appError.ts
export class AppError extends Error {
    public statusCode: number;
    public status: string;
    public isOperational: boolean;

    constructor(message: string, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}
