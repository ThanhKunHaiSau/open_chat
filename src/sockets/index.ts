import type { Server, Socket } from "socket.io";
import { addContact } from "./contact/index.js";
import { setUserValueSocket } from "../config/socket.js";

export const initSockets = (io: Server) => {
    // 1. Cấu hình middleware xác thực token cho socket
    setUserValueSocket(io);
    // 2. Đăng ký các module sự kiện
    io.on('connection', (socket: Socket) => {
        addContact(io, socket);
    });


};
