import type { Server, Socket } from "socket.io";
import { addContact, groupContact } from "./contact/index.js";
import { setUserValueSocket } from "../config/socket.js";
import { isOnline } from "./me/me.online.js";
import { callSocket, chatSocket } from "./chat/index.js"

export const initSockets = (io: Server) => {
    // 1. Cấu hình middleware xác thực token cho socket
    setUserValueSocket(io);
    io.on('connection', (socket: Socket) => {
        addContact(io, socket);
        isOnline(io, socket);
        chatSocket(io, socket);
        groupContact(io, socket);
        callSocket(io, socket);
    });
};
