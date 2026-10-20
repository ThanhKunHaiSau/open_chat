import jwt from "jsonwebtoken"
import config from "../config/index.js"
const secretkey = config.auth.secret || ""
const expr = config.auth.expiresIn || "15m";
export const signToken = (payload: any, p0?: string) => {

    const token = jwt.sign(payload, secretkey, { expiresIn: expr as any });
    if (!token) {
        throw new Error("Tạo token thất bại");
    }
    return token;
}

export const verifyToken = (token: string) => {
    return jwt.verify(token, secretkey);
}