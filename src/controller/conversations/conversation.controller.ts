import mongoose from "mongoose";
import Conversation from "../../models/conversation.model.js";

/**
 * 1. Lấy danh sách tất cả cuộc trò chuyện của User hiện tại
 */
export const getAllConversations = async (userId: string) => {
    try {
        const userObjId = new mongoose.Types.ObjectId(userId);

        const data = await Conversation.find({
            participants: {
                $in: [userObjId]
            },
            deletedFor: { $ne: userObjId },
            deletedAt: null
        })
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar")
            .sort({ updatedAt: -1 });

        return data;
    } catch (error: any) {
        throw new Error(error.message || error);
    }
};

// Giữ alias tương thích nếu có code cũ gọi getAllConverSation
export const getAllConverSation = getAllConversations;

/**
 * 2. Tạo mới hoặc Lấy cuộc trò chuyện 1-1 có sẵn với một người bạn
 * Dùng khi user bấm "Nhắn tin" với 1 bạn bè trong danh bạ
 */
export const getOrCreateConversation = async (userId: string, targetUserId: string) => {
    try {
        if (!targetUserId) {
            throw new Error("targetUserId không được để trống");
        }
        if (userId === targetUserId) {
            throw new Error("Không thể tạo cuộc trò chuyện với chính mình");
        }

        const userObjId = new mongoose.Types.ObjectId(userId);
        const targetObjId = new mongoose.Types.ObjectId(targetUserId);

        // 1. Tìm xem đã có cuộc trò chuyện 1-1 giữa 2 người này chưa
        let conversation = await Conversation.findOne({
            type: "direct",
            participants: { $all: [userObjId, targetObjId], $size: 2 },
            deletedAt: null
        })
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar");

        // 2. Nếu chưa có thì khởi tạo mới
        if (!conversation) {
            const newConv = await Conversation.create({
                type: "direct",
                participants: [userObjId, targetObjId],
                unreadCounts: new Map([
                    [userId, 0],
                    [targetUserId, 0]
                ])
            });

            conversation = await Conversation.findById(newConv._id)
                .populate("participants", "username avatar gender phone address");
        }

        return conversation;
    } catch (error: any) {
        throw new Error(error.message || error);
    }
};
