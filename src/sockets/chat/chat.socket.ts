import type { Server, Socket } from "socket.io";
import {
    saveChatMessage,
    markMessagesAsRead,
} from "../../controller/index.js";

/**
 * Xử lý toàn bộ sự kiện Socket Real-time cho tính năng Chat
 * @param io Instance Socket.IO Server
 * @param socket Kết nối socket của người dùng hiện tại
 */
export const chatSocket = (io: Server, socket: Socket) => {
    const currentUserId = socket.data.user?.userId?.toString();

    // 1. Tham gia vào phòng chat của một cuộc hội thoại
    socket.on("join_conversation", (data: { conversationId: string }) => {
        const conversationId = data?.conversationId;
        if (conversationId) {
            socket.join(conversationId.toString());
            console.log(`⚡ [Socket Chat] User ${currentUserId} đã join room: ${conversationId}`);
        }
    });

    // 2. Rời khỏi phòng chat
    socket.on("leave_conversation", (data: { conversationId: string }) => {
        const conversationId = data?.conversationId;
        if (conversationId) {
            socket.leave(conversationId.toString());
            console.log(`🔌 [Socket Chat] User ${currentUserId} đã rời room: ${conversationId}`);
        }
    });

    // 3. Gửi tin nhắn mới Realtime (Ủy quyền lưu DB cho Controller)
    socket.on("send_message", async (data: {
        conversationId: string;
        content?: string;
        type?: "text" | "image" | "file" | "sticker";
        file?: {
            url: string;
            fileName?: string;
            fileSize?: number;
            contentType?: string;
        };
        replyTo?: string;
    }) => {
        try {
            if (!currentUserId) {
                console.warn("⚠️ [Socket Chat] Gửi tin nhắn thất bại: Chưa đăng nhập");
                return;
            }

            const { conversationId, content, type = "text", file, replyTo } = data;

            if (!conversationId) {
                console.warn("⚠️ [Socket Chat] Gửi tin nhắn thất bại: Thiếu conversationId");
                return;
            }

            // Tin nhắn phải có nội dung hoặc có file/ảnh đính kèm
            if (!content?.trim() && !file?.url) {
                return;
            }

            // Gọi Controller để tạo Message & cập nhật Conversation
            const { message: populatedMsg, conversation: updatedConv } = await saveChatMessage({
                conversationId,
                senderId: currentUserId,
                content,
                type,
                file,
                replyTo,
            });

            // Bắn tin nhắn mới tới tất cả participants (thông qua room cá nhân và room conversation)
            io.to(conversationId.toString()).emit("receive_message", populatedMsg);

            // Bắn sự kiện cập nhật hội thoại cho tất cả participants (để sidebar bên trái tự nhảy lên đầu)
            if (updatedConv?.participants) {
                updatedConv.participants.forEach((p: any) => {
                    const participantId = (p._id || p).toString();
                    io.to(participantId).emit("conversation_updated", updatedConv);
                    io.to(participantId).emit("receive_message", populatedMsg);
                });
            }

            console.log(`📨 [Socket Chat] Tin nhắn từ ${currentUserId} trong room ${conversationId} đã được gửi.`);
        } catch (error: any) {
            console.error("❌ [Socket Chat] Lỗi xử lý send_message:", error);
            socket.emit("send_message_error", {
                message: error.message || "Gửi tin nhắn thất bại",
            });
        }
    });

    // 4. Bắt đầu gõ phím (Typing Indicator)
    socket.on("typing_start", (data: { conversationId: string }) => {
        const conversationId = data?.conversationId;
        if (conversationId && currentUserId) {
            socket.to(conversationId.toString()).emit("user_typing", {
                conversationId,
                userId: currentUserId,
                isTyping: true,
            });
        }
    });

    // 5. Ngừng gõ phím
    socket.on("typing_stop", (data: { conversationId: string }) => {
        const conversationId = data?.conversationId;
        if (conversationId && currentUserId) {
            socket.to(conversationId.toString()).emit("user_typing", {
                conversationId,
                userId: currentUserId,
                isTyping: false,
            });
        }
    });

    // 6. Đánh dấu đã đọc tin nhắn (Ủy quyền cập nhật DB cho Controller)
    socket.on("mark_read", async (data: { conversationId: string }) => {
        try {
            const conversationId = data?.conversationId;
            if (!conversationId || !currentUserId) return;

            const { reader, readAt } = await markMessagesAsRead(
                conversationId,
                currentUserId,
                {
                    username: socket.data.user?.username,
                    avatar: socket.data.user?.avatar,
                }
            );

            // Báo cho toàn bộ thành viên trong phòng biết user này đã đọc tin nhắn
            io.to(conversationId.toString()).emit("messages_read", {
                conversationId,
                userId: currentUserId,
                reader,
                readAt,
            });
        } catch (error: any) {
            console.error("❌ [Socket Chat] Lỗi xử lý mark_read:", error);
        }
    });
};

export default chatSocket;
