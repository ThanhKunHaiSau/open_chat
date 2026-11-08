import mongoose from "mongoose";
import Message from "../../models/message.model.js";
import User from "../../models/user.model.js";
import { handleUploadFile } from "../common/filehelper.controller.js";
import Conversation from "../../models/conversation.model.js";
import { AppError } from "../../common/appError.js";
import { getOrCreateConversation } from "./conversation.controller.js";
import { redisService } from "../../common/redis.service.js";

/**
 * 3. Lấy danh sách tin nhắn của một cuộc trò chuyện (có phân trang)
 */
const TypeMedia = {
    IMAGE: "images",
    VIDEO: "video",
    FILE: "files",
    TEXT: "text",
    STICKER: "sticker",
    CALL: "call",
}
export const getConversationMessages = async (
    conversationId: string,
    page: number = 1,
    limit: number = 20
) => {
    try {
        if (!conversationId) {
            throw new Error("conversationId không được để trống");
        }

        const convObjId = new mongoose.Types.ObjectId(conversationId);
        const skip = (page - 1) * limit;

        // Query tin nhắn mới nhất trước (sort createdAt: -1) để lấy 20 tin gần nhất
        const messages = await Message.find({
            conversationId: convObjId,
            deletedAt: null
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("senderId", "username avatar")
            .populate("readBy.userId", "username avatar")
            .populate("replyTo");

        const total = await Message.countDocuments({
            conversationId: convObjId,
            deletedAt: null
        });

        return {
            // Đảo ngược lại để Frontend hiển thị từ cũ -> mới (từ trên xuống dưới)
            messages: messages.reverse(),
            total,
            page,
            limit,
            totalPage: Math.ceil(total / limit)
        };
    } catch (error: any) {
        throw new Error(error.message || error);
    }
};

export interface IUploadImageParams {
    file: Buffer;
    conversationId: string;
    userId: string;
    originalName?: string;
    mimeType?: string;
    io?: any;
}

export const handleUploadImage = async (
    fileOrParams: Buffer | IUploadImageParams,
    convId?: string,
    uId?: string,
    options?: { originalName?: string; mimeType?: string; io?: any }
) => {
    try {
        let file: Buffer;
        let conversationId: string;
        let userId: string;
        let originalName: string | undefined;
        let mimeType: string | undefined;
        let io: any;

        if (Buffer.isBuffer(fileOrParams)) {
            file = fileOrParams;
            conversationId = convId!;
            userId = uId!;
            originalName = options?.originalName;
            mimeType = options?.mimeType;
            io = options?.io;
        } else {
            file = fileOrParams.file;
            conversationId = fileOrParams.conversationId;
            userId = fileOrParams.userId;
            originalName = fileOrParams.originalName;
            mimeType = fileOrParams.mimeType;
            io = fileOrParams.io;
        }

        if (!conversationId) {
            throw new AppError("conversationId không được để trống", 400);
        }

        const converObjId = new mongoose.Types.ObjectId(conversationId);
        const userObjId = new mongoose.Types.ObjectId(userId);

        // 1. Kiểm tra xem người dùng có nằm trong cuộc trò chuyện này không
        const findConver = await Conversation.findOne({
            _id: converObjId,
            participants: {
                $in: [userObjId]
            },
            deletedAt: null
        });

        if (!findConver) {
            throw new AppError("Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập", 404);
        }

        // 2. Upload file ảnh lên Cloudinary (giữ nguyên tỉ lệ, không ép crop vuông)
        const uploadImg = await handleUploadFile("open_chat/mess/image", file, { isAvatar: false });

        // 3. Map các trường dữ liệu file
        const fileData = {
            url: uploadImg.secure_url,
            fileName: originalName || `${uploadImg.original_filename}.${uploadImg.format}`,
            fileSize: uploadImg.bytes || 0,
            contentType: mimeType || `${uploadImg.resource_type}/${uploadImg.format}`,
        };

        // 4. Lưu Message vào MongoDB
        const newMsg = await Message.create({
            conversationId: converObjId,
            senderId: userObjId,
            content: "",
            type: "image",
            file: fileData,
            status: "sent",
        });

        // 5. Populate thông tin người gửi
        const populatedMsg = await Message.findById(newMsg._id)
            .populate("senderId", "username avatar")
            .populate("readBy.userId", "username avatar")
            .populate("replyTo");
        console.log("🚀 ~ handleUploadFile ~ populatedMsg:", populatedMsg)

        // 6. Cập nhật lastMessage & unreadCounts trong Conversation
        const incFields: Record<string, number> = {};
        if (findConver.participants) {
            findConver.participants.forEach((p: any) => {
                const pId = (p._id || p).toString();
                if (pId !== userId.toString()) {
                    incFields[`unreadCounts.${pId}`] = 1;
                }
            });
        }

        const updatePayload: any = {
            lastMessage: {
                messageId: newMsg._id,
                senderId: userObjId,
                content: "[Hình ảnh]",
                type: "image",
                createdAt: new Date(),
            },
            updatedAt: new Date(),
        };

        if (Object.keys(incFields).length > 0) {
            updatePayload.$inc = incFields;
        }

        const updatedConv = await Conversation.findByIdAndUpdate(
            converObjId,
            updatePayload,
            { returnDocument: 'after' }
        )
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar");

        // 7. Bắn Socket.IO Real-time cho các bên
        if (io) {
            io.to(conversationId.toString()).emit("receive_message", populatedMsg);
            if (updatedConv?.participants) {
                updatedConv.participants.forEach((p: any) => {
                    const participantId = (p._id || p).toString();
                    io.to(participantId).emit("conversation_updated", updatedConv);
                    io.to(participantId).emit("receive_message", populatedMsg);
                });
            }
        }
        // Invalidate cache media của hội thoại
        await redisService.clearConversationMediaCache(conversationId);
        return populatedMsg;
    } catch (error: any) {
        throw new AppError(error.message || "Upload ảnh thất bại", error.statusCode || 500);
    }
};

export interface IUploadDocumentParams {
    file: Buffer;
    conversationId: string;
    userId: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
    io?: any;
}

export const handleUploadDocumentFile = async (
    fileOrParams: Buffer | IUploadDocumentParams,
    convId?: string,
    uId?: string,
    options?: { originalName?: string; mimeType?: string; size?: number; io?: any }
) => {
    try {
        let file: Buffer;
        let conversationId: string;
        let userId: string;
        let originalName: string | undefined;
        let mimeType: string | undefined;
        let fileSize: number = 0;
        let io: any;

        if (Buffer.isBuffer(fileOrParams)) {
            file = fileOrParams;
            conversationId = convId!;
            userId = uId!;
            originalName = options?.originalName;
            mimeType = options?.mimeType;
            fileSize = options?.size || file.length;
            io = options?.io;
        } else {
            file = fileOrParams.file;
            conversationId = fileOrParams.conversationId;
            userId = fileOrParams.userId;
            originalName = fileOrParams.originalName;
            mimeType = fileOrParams.mimeType;
            fileSize = fileOrParams.size || file.length;
            io = fileOrParams.io;
        }

        if (!conversationId) {
            throw new AppError("conversationId không được để trống", 400);
        }

        const converObjId = new mongoose.Types.ObjectId(conversationId);
        const userObjId = new mongoose.Types.ObjectId(userId);

        // 1. Kiểm tra xem người dùng có nằm trong cuộc trò chuyện này không
        const findConver = await Conversation.findOne({
            _id: converObjId,
            participants: {
                $in: [userObjId]
            },
            deletedAt: null
        });

        if (!findConver) {
            throw new AppError("Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập", 404);
        }

        // 2. Upload file tài liệu lên Cloudinary dưới dạng raw file
        const uploadDoc = await handleUploadFile("open_chat/mess/files", file, {
            isRawFile: true,
            originalName: originalName || "document",
        });

        const finalFileName = originalName || uploadDoc.original_filename || "Tập tin";
        const finalUrl = uploadDoc.secure_url || uploadDoc.url;

        // 3. Map các trường dữ liệu file
        const fileData = {
            url: finalUrl,
            fileName: finalFileName,
            fileSize: uploadDoc.bytes || fileSize || 0,
            contentType: mimeType || uploadDoc.format || "application/octet-stream",
        };

        // 4. Lưu Message vào MongoDB
        const newMsg = await Message.create({
            conversationId: converObjId,
            senderId: userObjId,
            content: finalFileName,
            type: "file",
            file: fileData,
            status: "sent",
        });

        // 5. Populate thông tin người gửi
        const populatedMsg = await Message.findById(newMsg._id)
            .populate("senderId", "username avatar")
            .populate("readBy.userId", "username avatar")
            .populate("replyTo");
        // 6. Cập nhật lastMessage & unreadCounts trong Conversation
        const incFields: Record<string, number> = {};
        if (findConver.participants) {
            findConver.participants.forEach((p: any) => {
                const pId = (p._id || p).toString();
                if (pId !== userId.toString()) {
                    incFields[`unreadCounts.${pId}`] = 1;
                }
            });
        }

        const updatePayload: any = {
            lastMessage: {
                messageId: newMsg._id,
                senderId: userObjId,
                content: `[Tập tin] ${finalFileName}`,
                type: "file",
                createdAt: new Date(),
            },
            updatedAt: new Date(),
        };

        if (Object.keys(incFields).length > 0) {
            updatePayload.$inc = incFields;
        }

        const updatedConv = await Conversation.findByIdAndUpdate(
            converObjId,
            updatePayload,
            { returnDocument: 'after' }
        )
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar");

        // 7. Bắn Socket.IO Real-time cho các bên
        if (io) {
            io.to(conversationId.toString()).emit("receive_message", populatedMsg);
            if (updatedConv?.participants) {
                updatedConv.participants.forEach((p: any) => {
                    const participantId = (p._id || p).toString();
                    io.to(participantId).emit("conversation_updated", updatedConv);
                    io.to(participantId).emit("receive_message", populatedMsg);
                });
            }
        }
        // Invalidate cache media của hội thoại
        await redisService.clearConversationMediaCache(conversationId);
        return populatedMsg;
    } catch (error: any) {
        throw new AppError(error.message || "Upload tệp tin thất bại", error.statusCode || 500);
    }
};


export const getConversationMedia = async (
    conversationId: string,
    type: string = "all",
    userId: string
) => {
    try {
        if (!conversationId) {
            throw new AppError("conversationId không được để trống", 400);
        }
        const keyPefix = `media-file:${conversationId}:${type}`;
        const dataRedis = await redisService.getKeyCache(userId, keyPefix);
        if (dataRedis) {
            try {
                return typeof dataRedis === "string" ? JSON.parse(dataRedis) : dataRedis;
            } catch (e) {
                // Nếu dữ liệu cache lỗi cú pháp thì bỏ qua để truy vấn lại DB
            }
        }
        const convObjId = new mongoose.Types.ObjectId(conversationId);
        const filter: any = {
            conversationId: convObjId,
            deletedAt: null,
        };

        if (type === "image") {
            filter.type = "image";
        } else if (type === "file") {
            filter.type = "file";
        } else {
            filter.type = { $in: ["image", "file"] };
        }

        const messages = await Message.find(filter)
            .sort({ createdAt: -1 })
            .populate("senderId", "username avatar")
            .select("_id conversationId senderId content type file createdAt");

        const images = messages.filter((m) => m.type === "image" && m.file?.url);
        const files = messages.filter((m) => m.type === "file" && m.file?.url);
        const dataResult = {
            images,
            files,
            totalImages: images.length,
            totalFiles: files.length,
        };
        await redisService.setKeyCache(userId, keyPefix, dataResult, 60 * 60 * 24 * 7)
        return dataResult;

    } catch (error: any) {
        throw new AppError(error.message || "Lấy tệp phương tiện thất bại", error.statusCode || 500);
    }
};

/**
 * 6. Lưu tin nhắn chat mới từ Socket và cập nhật hội thoại
 */
export interface ISaveChatMessageParams {
    conversationId: string;
    senderId: string;
    content?: string | undefined;
    type?: "text" | "image" | "file" | "sticker" | "call" | undefined;
    file?: {
        url: string;
        fileName?: string | undefined;
        fileSize?: number | undefined;
        contentType?: string | undefined;
    } | null | undefined;
    replyTo?: string | null | undefined;
}

export const saveChatMessage = async (params: ISaveChatMessageParams) => {
    try {
        const { conversationId, senderId, content, type = "text", file, replyTo } = params;

        if (!conversationId) {
            throw new AppError("conversationId không được để trống", 400);
        }
        if (!senderId) {
            throw new AppError("senderId không được để trống", 400);
        }

        const convObjId = new mongoose.Types.ObjectId(conversationId);
        const senderObjId = new mongoose.Types.ObjectId(senderId);

        // 1. Lưu tin nhắn mới vào MongoDB
        const messagePayload: any = {
            conversationId: convObjId,
            senderId: senderObjId,
            content: content?.trim() || "",
            type,
            file: file
                ? {
                    url: file.url,
                    fileName: file.fileName || null,
                    fileSize: file.fileSize || 0,
                    contentType: file.contentType || null,
                }
                : null,
            replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : null,
            status: "sent",
        };

        const newMsg: any = await Message.create(messagePayload);

        // 2. Populate thông tin người gửi
        const populatedMsg = await Message.findById(newMsg._id)
            .populate("senderId", "username avatar")
            .populate("replyTo");

        // 3. Cập nhật preview lastMessage và tăng unreadCounts
        let lastMessagePreview = content?.trim() || "";
        if (type === "image") lastMessagePreview = "[Hình ảnh]";
        if (type === "file") lastMessagePreview = `[Tệp] ${file?.fileName || "tập tin"}`;
        if (type === "sticker") lastMessagePreview = "[Nhãn dán]";
        if (type === "call") lastMessagePreview = content?.trim() || "[Cuộc gọi]";

        const currentConv = await Conversation.findById(convObjId);
        const incFields: Record<string, number> = {};
        if (currentConv && currentConv.participants) {
            currentConv.participants.forEach((p: any) => {
                const pId = (p._id || p).toString();
                if (pId !== senderId.toString()) {
                    incFields[`unreadCounts.${pId}`] = 1;
                }
            });
        }

        const updatePayload: any = {
            lastMessage: {
                messageId: newMsg._id,
                senderId: senderObjId,
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
            convObjId,
            updatePayload,
            { returnDocument: "after" }
        )
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar");

        // Invalidate cache media nếu là hình ảnh hoặc tệp tin
        if (type === "image" || type === "file") {
            await redisService.clearConversationMediaCache(conversationId);
        }

        return {
            message: populatedMsg,
            conversation: updatedConv,
        };
    } catch (error: any) {
        throw new AppError(error.message || "Lưu tin nhắn thất bại", error.statusCode || 500);
    }
};

/**
 * 7. Đánh dấu tất cả tin nhắn trong cuộc trò chuyện là đã đọc
 */
export const markMessagesAsRead = async (
    conversationId: string,
    userId: string,
    userInfo?: { username?: string; avatar?: string }
) => {
    try {
        if (!conversationId || !userId) {
            throw new AppError("Thiếu conversationId hoặc userId", 400);
        }

        const convObjId = new mongoose.Types.ObjectId(conversationId);
        const userObjId = new mongoose.Types.ObjectId(userId);

        // 1. Reset unreadCounts về 0
        await Conversation.findByIdAndUpdate(convObjId, {
            $set: { [`unreadCounts.${userId}`]: 0 },
        });

        // 2. Lấy thông tin người đọc
        let username: string | null | undefined = userInfo?.username;
        let avatar: string | null | undefined = userInfo?.avatar;
        if (!username || !avatar) {
            const u = await User.findById(userObjId).select("username avatar");
            if (u) {
                username = u.username;
                avatar = u.avatar;
            }
        }

        const readAt = new Date();

        // 3. Cập nhật status="read" và push vào readBy
        await Message.updateMany(
            {
                conversationId: convObjId,
                senderId: { $ne: userObjId },
                "readBy.userId": { $ne: userObjId },
            },
            {
                $set: { status: "read" },
                $push: {
                    readBy: {
                        userId: userObjId,
                        readAt,
                    },
                },
            }
        );

        return {
            reader: {
                _id: userId,
                username: username || "Thành viên",
                avatar: avatar || null,
            },
            readAt,
        };
    } catch (error: any) {
        throw new AppError(error.message || "Đánh dấu đã đọc thất bại", error.statusCode || 500);
    }
};

/**
 * 8. Lưu bản ghi tin nhắn lịch sử cuộc gọi (Call Log) vào MongoDB
 */
export interface ISaveCallLogParams {
    callerId: string;
    receiverId: string;
    callType: "video" | "audio";
    conversationId?: string | undefined;
    duration: number;
    status: "completed" | "missed" | "rejected" | "busy" | "failed";
}

export const saveCallLogMessage = async (params: ISaveCallLogParams) => {
    try {
        const { callerId, receiverId, callType, duration, status } = params;

        const callLabel = callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";
        let content = "";

        if (status === "completed") {
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;
            const timeStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
            content = `${callLabel} (${timeStr})`;
        } else if (status === "rejected") {
            content = `${callLabel} bị từ chối`;
        } else if (status === "busy") {
            content = `${callLabel} (Máy bận)`;
        } else {
            content = `${callLabel} nhỡ`;
        }

        // 1. Tìm hoặc tạo cuộc trò chuyện 1-1 giữa 2 người
        let convId = params.conversationId;
        if (!convId) {
            const conv = await getOrCreateConversation(callerId, receiverId);
            convId = conv?._id?.toString();
        }

        if (!convId) {
            throw new AppError("Không tìm thấy cuộc trò chuyện để lưu cuộc gọi", 404);
        }

        const convObjId = new mongoose.Types.ObjectId(convId);
        const callerObjId = new mongoose.Types.ObjectId(callerId);
        const receiverObjId = new mongoose.Types.ObjectId(receiverId);

        // 2. Tạo bản ghi Message loại "call"
        const newMsg = await Message.create({
            conversationId: convObjId,
            senderId: callerObjId,
            receiverId: receiverObjId,
            content,
            type: "call",
            call: {
                callType,
                duration,
                status,
            },
            status: "sent",
        });

        const populatedMsg = await Message.findById(newMsg._id)
            .populate("senderId", "username avatar");

        // 3. Cập nhật preview lastMessage trong Conversation
        const incFields: Record<string, number> = {};
        if (status === "missed") {
            incFields[`unreadCounts.${receiverId}`] = 1;
        }

        const updatePayload: any = {
            lastMessage: {
                messageId: newMsg._id,
                senderId: callerObjId,
                content,
                type: "call",
                createdAt: new Date(),
            },
            updatedAt: new Date(),
        };

        if (Object.keys(incFields).length > 0) {
            updatePayload.$inc = incFields;
        }

        const updatedConv = await Conversation.findByIdAndUpdate(
            convObjId,
            updatePayload,
            { returnDocument: "after" }
        )
            .populate("participants", "username avatar gender phone address")
            .populate("lastMessage.senderId", "username avatar");

        return {
            message: populatedMsg,
            conversation: updatedConv,
            conversationId: convId,
        };
    } catch (error: any) {
        throw new AppError(error.message || "Lưu lịch sử cuộc gọi thất bại", error.statusCode || 500);
    }
};

