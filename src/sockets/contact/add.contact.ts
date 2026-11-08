import type { Server, Socket } from "socket.io";
import {
    createNoitication,
    cancelFriendRequestNotification,
} from "../../controller/noitication/noitication.controller.js";

/**
 * @param io Instance từ Server socket.io
 */
export const addContact = (io: Server, socket: Socket) => {
    // 1. Gửi lời mời kết bạn
    socket.on("add_contact", async (data: any) => {
        const userCurent = {
            id: socket.data.user.userId,
            avatar: socket.data.user.avatar,
            username: socket.data.user.username,
        };
        const receiverId = data.contactId;

        // Lưu thông báo vào MongoDB
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

        // Bắn Realtime sang cho người nhận
        io.to(receiverId).emit("res_add_contact", {
            id: savedNotif?._id?.toString() || `notif-${Date.now()}`,
            userCurent,
            message: `${userCurent.username} đã gửi cho bạn một lời mời kết bạn!`,
            createdAt: savedNotif?.createdAt || new Date().toISOString(),
        });
    });

    // 2. Huỷ lời mời kết bạn
    socket.on("cancel_contact", async (data: any) => {
        const userCurent = {
            id: socket.data.user.userId,
            avatar: socket.data.user.avatar,
            username: socket.data.user.username,
        };
        const receiverId = data.contactId;

        // Xoá mềm thông báo tương ứng trong DB thông qua Controller
        try {
            await cancelFriendRequestNotification(userCurent.id, receiverId);
        } catch (err) {
            console.error("Lỗi khi xoá thông báo:", err);
        }

        io.to(receiverId).emit("res_cancel_contact", userCurent);
    });

    // 3. Chấp nhận lời mời kết bạn
    socket.on("accept_contact", async (data: any) => {
        const userCurent = {
            id: socket.data.user.userId,
            avatar: socket.data.user.avatar,
            username: socket.data.user.username,
        };
        const receiverId = data.contactId;

        let savedNotif: any = null;
        try {
            savedNotif = await createNoitication({
                sender: userCurent,
                receiver: { id: receiverId },
                content: `${userCurent.username} đã chấp nhận lời mời kết bạn!`,
                type: "friend_accepted",
                isRead: false,
            });
        } catch (err) {
            console.error("Lỗi khi lưu thông báo chấp nhận kết bạn:", err);
        }

        // Bắn Realtime phản hồi sang cho người ban đầu đã gửi lời mời
        io.to(receiverId).emit("res_accept_contact", {
            id: savedNotif?._id?.toString() || `notif-${Date.now()}`,
            userCurent,
            message: `${userCurent.username} đã chấp nhận lời mời kết bạn!`,
            createdAt: savedNotif?.createdAt || new Date().toISOString(),
        });
    });
};
