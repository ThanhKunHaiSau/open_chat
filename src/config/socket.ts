import { Socket, type Server } from "socket.io";
import { verifyToken } from "../common/auth.common.js";
import logger from "./logger.js";
import { type IUser } from "../interfaces/index.js"
/**
 * @param io from socket.io
 */
export const setUserValueSocket = (io: Server) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            logger.warn(`Từ chối kết nối socket ${socket.id}: Không có token`);
            return next(new Error("Authentication error: Không tìm thấy token"));
        }

        try {
            const decoded = verifyToken(token) as IUser;
            socket.data.user = decoded;
            next();
        } catch (err) {
            logger.warn(`Từ chối kết nối socket ${socket.id}: Token không hợp lệ`);
            return next(new Error("Authentication error: Token không hợp lệ hoặc đã hết hạn"));
        }
    });

    io.on("connection", (socket) => {
        const user = socket.data.user;
        const userId = user?.userId?.toString();
        if (userId) {
            socket.join(userId);
        }
        logger.info(`User ${userId} (${socket.id}) đã kết nối thành công!`);
        socket.on("disconnect", () => {
            logger.info(`User ${socket.id} đã ngắt kết nối.`);
        });
    });
};
