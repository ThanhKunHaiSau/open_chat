import mongoose from "mongoose";
import Message from "../../models/message.model.js";
import { handleUploadFile } from "../common/filehelper.controller.js";
import Conversation from "../../models/conversation.model.js";
import { AppError } from "../../common/appError.js";

/**
 * 3. Lấy danh sách tin nhắn của một cuộc trò chuyện (có phân trang)
 */
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

        return populatedMsg;
    } catch (error: any) {
        throw new AppError(error.message || "Upload ảnh thất bại", error.statusCode || 500);
    }
};