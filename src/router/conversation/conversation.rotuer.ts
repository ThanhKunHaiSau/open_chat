import { Router, type NextFunction, type Request, type Response } from "express";
import {
    getAllConversations,
    getOrCreateConversation,
    getOrCreateGroupConversation,
    getConversationMessages,
    updateConversation,
    updateGroupAvatar,
    updateConversationBackground,
    getConversationMedia,
} from "../../controller/index.js";
import { uploadAvatarMiddleware } from "../../config/cloudinary.js";
import { AppError } from "../../common/appError.js";
import { validateRequest } from "../../middleware/validate/validate.middleware.js";
import { validateMessage } from "../../validate/message.validate.js";

export const router = Router();


router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user.userId;
        const result = await getAllConversations(userId);
        return res.success(result, "Lấy danh sách cuộc trò chuyện thành công");
    } catch (error: any) {
        next(new AppError(error.message, error.statusCode || 500));
    }
});


router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user.userId;
        const { targetUserId } = req.body;

        if (!targetUserId) {
            return next(new AppError("targetUserId là bắt buộc", 400));
        }

        const result = await getOrCreateConversation(userId, targetUserId);
        return res.success(result, "Lấy thông tin cuộc trò chuyện thành công");
    } catch (error: any) {
        next(new AppError(error.message, error.statusCode || 500));
    }
});

router.post("/create-group", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user.userId;
        const { memberIds, name } = req.body;

        if (!Array.isArray(memberIds) || memberIds.length < 1) {
            return next(new AppError("Danh sách thành viên phải có ít nhất 1 người", 400));
        }

        const result = await getOrCreateGroupConversation(userId, memberIds, name);

        // Bắn Socket thông báo nhóm mới cho tất cả các thành viên
        const io = req.app.get("io");
        if (io && result?.participants) {
            result.participants.forEach((p: any) => {
                const pId = (p._id || p).toString();
                io.to(pId).emit("conversation_updated", result);
            });
        }

        return res.success(result, "Tạo nhóm trò chuyện thành công");
    } catch (error: any) {
        next(new AppError(error.message, error.statusCode || 500));
    }
});

router.get("/:conversationId/messages",
    validateRequest(validateMessage),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const conversationId = req.params.conversationId as string;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;

            const result = await getConversationMessages(conversationId, page, limit);
            return res.success(result, "Lấy danh sách tin nhắn thành công");
        } catch (error: any) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    });

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversationId = req.params.id as string;
        const { memberIds, name, avatar, theme, background } = req.body;
        const userId = req.user.userId;
        const result = await updateConversation(conversationId, userId, {
            memberIds,
            name,
            avatar,
            theme,
            background,
        });

        // Bắn Socket thông báo cập nhật cho tất cả thành viên trong cuộc trò chuyện
        const io = req.app.get("io");
        if (io && result?.participants) {
            result.participants.forEach((p: any) => {
                const pId = (p._id || p).toString();
                io.to(pId).emit("conversation_updated", result);
            });
        }

        return res.success(result, "Cập nhật cuộc trò chuyện thành công");
    } catch (error: any) {
        next(new AppError(error.message, error.statusCode || 500));
    }
});


router.put(
    "/:id/avatar",
    uploadAvatarMiddleware.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const conversationId = req.params.id as string;
            const userId = req.user.userId;

            if (!req.file) {
                return next(new AppError("Không tìm thấy file ảnh", 400));
            }

            const result = await updateGroupAvatar(conversationId, userId, req.file.buffer);

            // Bắn Socket thông báo cập nhật avatar cho tất cả thành viên trong nhóm
            const io = req.app.get("io");
            if (io && result?.participants) {
                result.participants.forEach((p: any) => {
                    const pId = (p._id || p).toString();
                    io.to(pId).emit("conversation_updated", result);
                });
            }

            return res.success(result, "Cập nhật ảnh đại diện nhóm thành công");
        } catch (error: any) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    }
);


router.put(
    "/:id/background",
    uploadAvatarMiddleware.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const conversationId = req.params.id as string;
            const userId = req.user.userId;

            if (!req.file) {
                return next(new AppError("Không tìm thấy file hình nền", 400));
            }

            const result = await updateConversationBackground(conversationId, userId, req.file.buffer);

            // Bắn Socket thông báo cập nhật hình nền cho tất cả thành viên trong cuộc trò chuyện
            const io = req.app.get("io");
            if (io && result?.participants) {
                result.participants.forEach((p: any) => {
                    const pId = (p._id || p).toString();
                    io.to(pId).emit("conversation_updated", result);
                });
            }

            return res.success(result, "Cập nhật hình nền thành công");
        } catch (error: any) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    }
);


router.get("/:conversationId/media", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversationId = req.params.conversationId as string;
        const type = (req.query.type as string) || "all";
        const userId = req.user.userId;
        const result = await getConversationMedia(conversationId, type, userId);
        return res.success(result, "Lấy danh sách tệp phương tiện thành công");
    } catch (error: any) {
        next(new AppError(error.message, error.statusCode || 500));
    }
});
