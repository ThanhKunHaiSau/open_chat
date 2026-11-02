import type { Server, Socket } from "socket.io";
import { addContact } from "./contact/index.js";
import { setUserValueSocket } from "../config/socket.js";
import { isOnline } from "./me/me.online.js";
import { chatSocket } from "./chat/chat.socket.js";

export const initSockets = (io: Server) => {
    // 1. Cấu hình middleware xác thực token cho socket
    setUserValueSocket(io);
    io.on('connection', (socket: Socket) => {
        addContact(io, socket);
        isOnline(io, socket);
        chatSocket(io, socket);
    });
};
