import { Router, type NextFunction, type Request, type Response } from "express";
import {
    getAllConversations,
    getOrCreateConversation,
    getOrCreateGroupConversation,
    getConversationMessages,
    updateConversation,
    updateGroupAvatar,
    updateConversationBackground,
} from "../../controller/index.js";
import { uploadAvatarMiddleware } from "../../config/cloudinary.js";
import { AppError } from "../../common/appError.js";

export const router = Router();

/**
 * 1. GET /api/v1/conversations
 * Lấy danh sách tất cả cuộc trò chuyện của user hiện tại
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user.userId;
        const result = await getAllConversations(userId);
        return res.success(result, "Lấy danh sách cuộc trò chuyện thành công");
    } catch (error: any) {
        next(new AppError(error.message, error.statusCode || 500));
    }
});

/**
 * 2. POST /api/v1/conversations
 * Lấy hoặc tạo mới cuộc trò chuyện 1-1 với một người bạn
 * Body: { targetUserId: string }
 */
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
/**
 * 3. GET /api/v1/conversations/:conversationId/messages
 * Lấy lịch sử tin nhắn của một cuộc trò chuyện (phân trang: page, limit)
 */
router.get("/:conversationId/messages", async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * 6. PUT /api/v1/conversations/:id/background
 * Upload hình nền (wallpaper) cuộc trò chuyện
 */
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
