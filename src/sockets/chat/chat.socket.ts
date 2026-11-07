import type { Server, Socket } from "socket.io";
import Message from "../../models/message.model.js";
import Conversation from "../../models/conversation.model.js";
import User from "../../models/user.model.js";

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

    // 3. Gửi tin nhắn mới Realtime
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

            // 3.1. Lưu tin nhắn mới vào MongoDB
            const newMsg = await Message.create({
                conversationId,
                senderId: currentUserId,
                content: content?.trim() || "",
                type,
                file: file || null,
                replyTo: replyTo || null,
                status: "sent",
            });

            // Populate thông tin người gửi để Frontend hiển thị avatar & tên
            const populatedMsg = await Message.findById(newMsg._id)
                .populate("senderId", "username avatar")
                .populate("replyTo");

            // 3.2. Cập nhật preview lastMessage trong bảng Conversation và tăng unreadCounts cho người nhận
            let lastMessagePreview = content?.trim() || "";
            if (type === "image") lastMessagePreview = "[Hình ảnh]";
            if (type === "file") lastMessagePreview = `[Tệp] ${file?.fileName || "tập tin"}`;
            if (type === "sticker") lastMessagePreview = "[Nhãn dán]";

            const currentConv = await Conversation.findById(conversationId);
            const incFields: Record<string, number> = {};
            if (currentConv && currentConv.participants) {
                currentConv.participants.forEach((p: any) => {
                    const pId = (p._id || p).toString();
                    if (pId !== currentUserId) {
                        incFields[`unreadCounts.${pId}`] = 1;
                    }
                });
            }

            const updatePayload: any = {
                lastMessage: {
                    messageId: newMsg._id,
                    senderId: currentUserId,
                    content: lastMessagePreview,
                    type,
                    createdAt: new Date(),
                },
                updatedAt: new Date(),
            };

            if (Object.keys(incFields).length > 0) {
                updatePayload.$inc = incFields;
            }

            const updatedConv = await Conversation.findByIdAndUpdate(
                conversationId,
                updatePayload,
                { returnDocument: 'after' }
            )
                .populate("participants", "username avatar gender phone address")
                .populate("lastMessage.senderId", "username avatar");

            // 3.3. Bắn tin nhắn mới tới tất cả participants (thông qua room cá nhân và room conversation)
            io.to(conversationId.toString()).emit("receive_message", populatedMsg);

            // 3.4. Bắn sự kiện cập nhật hội thoại cho tất cả participants (để sidebar bên trái tự nhảy lên đầu)
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

    // 6. Đánh dấu đã đọc tin nhắn
    socket.on("mark_read", async (data: { conversationId: string }) => {
        try {
            const conversationId = data?.conversationId;
            if (!conversationId || !currentUserId) return;

            // 6.1. Đặt số tin chưa đọc của user này về 0
            await Conversation.findByIdAndUpdate(conversationId, {
                $set: { [`unreadCounts.${currentUserId}`]: 0 },
            });

            // 6.2. Lấy thông tin người đọc (avatar & username)
            let username = socket.data.user?.username;
            let avatar = socket.data.user?.avatar;
            if (!avatar || !username) {
                const u = await User.findById(currentUserId).select("username avatar");
                if (u) {
                    username = u.username;
                    avatar = u.avatar;
                }
            }

            const readAt = new Date();

            // 6.3. Cập nhật trạng thái tin nhắn thành "read" và thêm user vào readBy nếu chưa có
            // Điều kiện "readBy.userId": { $ne: currentUserId } đảm bảo hỗ trợ đầy đủ cho cả nhóm (Group)
            // khi nhiều người cùng đọc một tin nhắn mà không bị ghi đè hay bỏ sót.
            await Message.updateMany(
                {
                    conversationId,
                    senderId: { $ne: currentUserId },
                    "readBy.userId": { $ne: currentUserId },
                },
                {
                    $set: { status: "read" },
                    $push: {
                        readBy: {
                            userId: currentUserId,
                            readAt,
                        },
                    },
                }
            );

            const reader = {
                _id: currentUserId,
                username: username || "Thành viên",
                avatar: avatar || null,
            };

            // 6.4. Báo cho toàn bộ thành viên trong phòng biết user này đã đọc tin nhắn
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
