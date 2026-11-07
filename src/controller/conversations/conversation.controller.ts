import mongoose from "mongoose";
import Conversation from "../../models/conversation.model.js";
import { AppError } from "../../common/appError.js";
import { handleUploadFile } from "../common/filehelper.controller.js";

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

export const getOrCreateGroupConversation = async (userId: string, memberIds: string[], name?: string) => {
    try {
        const userObjId = new mongoose.Types.ObjectId(userId);
        const targetObjIds = memberIds.map((id) => new mongoose.Types.ObjectId(id));
        const allParticipants = [userObjId, ...targetObjIds];

        // 1. Tìm xem đã có cuộc trò chuyện nhóm với đúng các thành viên này chưa (nếu không đặt tên riêng)
        let conversation = null;
        if (!name) {
            conversation = await Conversation.findOne({
                type: "group",
                participants: { $all: allParticipants, $size: allParticipants.length },
                deletedAt: null
            })
                .populate("participants", "username avatar gender phone address")
                .populate("lastMessage.senderId", "username avatar");
        }

        // 2. Nếu chưa có thì khởi tạo mới
        if (!conversation) {
            // Khởi tạo unreadCounts = 0 cho từng thành viên trong nhóm
            const unreadCounts = new Map<string, number>();
            [userId, ...memberIds].forEach((id) => {
                unreadCounts.set(id.toString(), 0);
            });

            const newConv = await Conversation.create({
                name: name?.trim() || null,
                type: "group",
                creatorId: userObjId,
                participants: allParticipants,
                unreadCounts,
            });

            conversation = await Conversation.findById(newConv._id)
                .populate("participants", "username avatar gender phone address");
        }

        return conversation;
    } catch (error: any) {
        throw new Error(error.message || error);
    }
};

export const updateConversation = async (
    conversationId: string,
    userId: string,
    data: {
        name?: string;
        avatar?: string;
        theme?: string | null;
        background?: {
            url?: string | null;
            gradient?: string | null;
        };
        memberIds?: string[];
    }
) => {
    try {
        const { name, avatar, theme, background, memberIds } = data;
        const convObjId = new mongoose.Types.ObjectId(conversationId);

        const conversation = await Conversation.findOne({
            _id: convObjId,
            deletedAt: null,
        });

        if (!conversation) {
            throw new AppError("Không tìm thấy cuộc trò chuyện", 404);
        }

        // Kiểm tra xem người cập nhật có nằm trong nhóm/cuộc trò chuyện không
        const isMember = conversation.participants.some(
            (p: any) => p.toString() === userId.toString()
        );
        if (!isMember) {
            throw new AppError("Bạn không có quyền cập nhật cuộc trò chuyện này", 403);
        }

        // Nếu cập nhật tên, avatar hoặc thành viên thì bắt buộc phải là group
        if (conversation.type !== "group" && (name !== undefined || avatar !== undefined || memberIds !== undefined)) {
            throw new AppError("Chỉ có thể cập nhật tên, ảnh đại diện hoặc thành viên đối với nhóm trò chuyện", 400);
        }

        const updatePayload: any = {
            updatedAt: new Date(),
        };

        // 1. Cập nhật tên nhóm nếu có
        if (name !== undefined && name.trim()) {
            updatePayload.name = name.trim();
        }

        // 2. Cập nhật avatar nhóm (nếu gửi link URL trực tiếp)
        if (avatar !== undefined) {
            updatePayload.avatar = avatar;
        }

        // 3. Cập nhật theme
        if (theme !== undefined) {
            updatePayload.theme = theme;
        }

        // 4. Cập nhật background (url và gradient)
        if (background !== undefined) {
            const currentBg = conversation.background || { url: null, gradient: null };
            updatePayload.background = {
                url: background.url !== undefined ? background.url : (currentBg.url || null),
                gradient: background.gradient !== undefined ? background.gradient : (currentBg.gradient || null),
            };
        }

        // 5. Cập nhật danh sách thành viên nếu có truyền lên
        if (memberIds && Array.isArray(memberIds)) {
            // Luôn đảm bảo có người đang thao tác và không bị trùng lặp
            const uniqueMemberIds = Array.from(new Set([...memberIds, userId]));

            if (uniqueMemberIds.length < 2) {
                throw new AppError("Nhóm trò chuyện phải có ít nhất 2 thành viên", 400);
            }

            updatePayload.participants = uniqueMemberIds.map(
                (id) => new mongoose.Types.ObjectId(id)
            );

            // Đảm bảo những thành viên mới cũng có biến đếm unreadCounts = 0
            uniqueMemberIds.forEach((id) => {
                if (!conversation.unreadCounts?.has?.(id)) {
                    updatePayload[`unreadCounts.${id}`] = 0;
                }
            });
        }

        // 6. Cập nhật và trả về Document mới nhất đầy đủ thông tin
        const updatedConv = await Conversation.findByIdAndUpdate(
            convObjId,
            updatePayload,
            { returnDocument: "after" }
        )
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar");

        return updatedConv;
    } catch (error: any) {
        throw new AppError(error.message || "Cập nhật nhóm thất bại", error.statusCode || 500);
    }
};

export const updateGroupAvatar = async (
    conversationId: string,
    userId: string,
    fileBuffer: Buffer
) => {
    try {
        const convObjId = new mongoose.Types.ObjectId(conversationId);
        const conversation = await Conversation.findOne({
            _id: convObjId,
            deletedAt: null,
        });

        if (!conversation) {
            throw new AppError("Không tìm thấy cuộc trò chuyện", 404);
        }

        if (conversation.type !== "group") {
            throw new AppError("Chỉ có thể cập nhật ảnh đại diện cho nhóm trò chuyện", 400);
        }

        const isMember = conversation.participants.some(
            (p: any) => p.toString() === userId.toString()
        );
        if (!isMember) {
            throw new AppError("Bạn không có quyền cập nhật nhóm này", 403);
        }

        const uploadResult: any = await handleUploadFile("open_chat/group_avatars", fileBuffer, {
            isAvatar: true,
        });

        const avatarUrl = uploadResult.secure_url;

        const updatedConv = await Conversation.findByIdAndUpdate(
            convObjId,
            { avatar: avatarUrl, updatedAt: new Date() },
            { returnDocument: "after" }
        )
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar");

        return updatedConv;
    } catch (error: any) {
        throw new AppError(error.message || "Upload avatar nhóm thất bại", error.statusCode || 500);
    }
};

export const updateConversationBackground = async (
    conversationId: string,
    userId: string,
    fileBuffer: Buffer
) => {
    try {
        const convObjId = new mongoose.Types.ObjectId(conversationId);
        const conversation = await Conversation.findOne({
            _id: convObjId,
            deletedAt: null,
        });

        if (!conversation) {
            throw new AppError("Không tìm thấy cuộc trò chuyện", 404);
        }

        const isMember = conversation.participants.some(
            (p: any) => p.toString() === userId.toString()
        );
        if (!isMember) {
            throw new AppError("Bạn không có quyền cập nhật cuộc trò chuyện này", 403);
        }

        const uploadResult: any = await handleUploadFile("open_chat/backgrounds", fileBuffer, {
            isAvatar: false,
        });

        const bgUrl = uploadResult.secure_url;

        const currentGradient = conversation.background?.gradient || null;

        const updatedConv = await Conversation.findByIdAndUpdate(
            convObjId,
            {
                background: {
                    url: bgUrl,
                    gradient: currentGradient,
                },
                updatedAt: new Date(),
            },
            { returnDocument: "after" }
        )
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar");

        return updatedConv;
    } catch (error: any) {
        throw new AppError(error.message || "Upload hình nền thất bại", error.statusCode || 500);
    }
};