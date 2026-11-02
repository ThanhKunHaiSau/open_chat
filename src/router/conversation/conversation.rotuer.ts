import { Router, type NextFunction, type Request, type Response } from "express";
import {
    getAllConversations,
    getOrCreateConversation,
    getConversationMessages
} from "../../controller/index.js";
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

