import e from "express";
import type { Server, Socket } from "socket.io";

/**
 * @param io Instance từ Server socket.io
 */
export const addContact = (io: Server, socket: Socket) => {
    socket.on("add_contact", (data: any) => {

        const userCurent = {
            id: socket.data.user.userId,
            avatar: socket.data.user.avatar,
            username: socket.data.user.username
        }
        socket.emit("res_add_contact", { userCurent, data })
    });

    socket.on("cancel_contact", (data: any) => {
        const userCurent = {
            id: socket.data.user.userId,
            avatar: socket.data.user.avatar,
            username: socket.data.user.username
        }
        socket.emit("res_cancel_contact", userCurent)
    });
};
