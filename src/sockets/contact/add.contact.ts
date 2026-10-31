import type { Server, Socket } from "socket.io";
import { createNoitication } from "../../controller/noitication/noitication.controller.js";
import Notification from "../../models/noitification.model.js";

/**
 * @param io Instance từ Server socket.io
 */
export const addContact = (io: Server, socket: Socket) => {
    socket.on("add_contact", async (data: any) => {
        const userCurent = {
            id: socket.data.user.userId,
            avatar: socket.data.user.avatar,
            username: socket.data.user.username,
        };
        const receiverId = data.contactId;

        // 1. Lưu thông báo vào MongoDB
        let savedNotif: any = null;
        try {
            savedNotif = await createNoitication({
                sender: userCurent,
                receiver: { id: receiverId },
                content: `${userCurent.username} đã gửi cho bạn một lời mời kết bạn!`,
                type: "friend_request",
                isRead: false,
            });
        } catch (err) {
            console.error("Lỗi khi lưu thông báo vào DB:", err);
        }

        // 2. Bắn Realtime sang cho người nhận
        io.to(receiverId).emit("res_add_contact", {
            id: savedNotif?._id?.toString() || `notif-${Date.now()}`,
            userCurent,
            message: `${userCurent.username} đã gửi cho bạn một lời mời kết bạn!`,
            createdAt: savedNotif?.createdAt || new Date().toISOString(),
        });
    });

    socket.on("cancel_contact", async (data: any) => {
        const userCurent = {
            id: socket.data.user.userId,
            avatar: socket.data.user.avatar,
            username: socket.data.user.username,
        };
        const receiverId = data.contactId;

        // Xoá mềm thông báo tương ứng trong DB
        try {
            await Notification.updateMany(
                {
                    "sender.id": userCurent.id,
                    "receiver.id": receiverId,
                    type: "friend_request",
                    deletedAt: null,
                },
                { deletedAt: new Date() }
            );
        } catch (err) {
            console.error("Lỗi khi xoá thông báo:", err);
        }

        io.to(receiverId).emit("res_cancel_contact", userCurent);
    });
};
