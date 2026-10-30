import jwt from "jsonwebtoken";
import config from "../config/index.js";
import { AppError } from "./appError.js";
import type { IUser } from "../interfaces/index.js";

const secretkey = config.auth.secret || "";
const defaultExpr = config.auth.expiresIn || "15m";

export const signToken = (payload: any, expiresIn?: string) => {
    const token = jwt.sign(payload, secretkey, {
        expiresIn: (expiresIn || defaultExpr) as any
    });
    if (!token) {
        throw new AppError("Tạo token thất bại", 500);
    }
    return token;
};


export const verifyToken = (token: string) => {
    try {
        const decode = jwt.verify(token, secretkey);
        return decode;
    } catch (error: any) {
        throw new AppError("Token không hợp lệ hoặc đã hết hạn", 401);
    }
};