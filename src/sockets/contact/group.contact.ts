import type { Server, Socket } from "socket.io";
import {
    createNoitication,
    getConversationById,
} from "../../controller/index.js";

export const groupContact = (io: Server, socket: Socket) => {
    socket.on("add_group", async (data: any) => {
        try {
            const conversationId = data?.conversationId;
            const memberIds = data?.memberIds;

            if (!conversationId || !Array.isArray(memberIds) || memberIds.length === 0) {
                return;
            }

            const userCurrent = {
                id: socket.data.user?.userId,
                avatar: socket.data.user?.avatar,
                username: socket.data.user?.username,
            };

            const conversation = await getConversationById(conversationId);

            if (!conversation) return;

            const groupName = conversation.name || "Nhóm trò chuyện mới";
            const notifyMessage = `Bạn đã được ${userCurrent.username} thêm vào nhóm "${groupName}"`;

            for (const memberId of memberIds) {
                const targetIdStr = memberId.toString();

                if (targetIdStr === userCurrent.id?.toString()) continue;

                let savedNotif: any = null;
                try {
                    savedNotif = await createNoitication({
                        sender: userCurrent,
                        receiver: { id: targetIdStr },
                        content: notifyMessage,
                        type: "group",
                        isRead: false,
                    });
                } catch (err) {
                    console.error("Lỗi lưu thông báo nhóm vào DB:", err);
                }

                io.to(targetIdStr).emit("res_add_group", {
                    id: savedNotif?._id?.toString() || `notif-${Date.now()}`,
                    conversationId,
                    conversation,
                    sender: userCurrent,
                    message: notifyMessage,
                    createdAt: new Date().toISOString(),
                });

                io.to(targetIdStr).emit("conversation_updated", conversation);
            }
        } catch (error) {
            console.error("❌ [Socket Group] Lỗi add_group:", error);
        }
    });
};

export default groupContact;