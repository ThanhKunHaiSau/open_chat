import { Router, type Request, type Response, type NextFunction } from "express";
import {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
} from "../../controller/noitication/noitication.controller.js";

export const router = Router();

/**
 * 1. GET /api/v1/notifications
 * Lấy danh sách thông báo của user hiện tại
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const result = await getNotifications(userId, req.query);
        return res.success(result, "Lấy danh sách thông báo thành công");
    } catch (error) {
        next(error);
    }
});

/**
 * 2. PUT /api/v1/notifications/read-all
 * Đánh dấu toàn bộ thông báo là đã đọc
 */
router.put("/read-all", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const result = await markAllNotificationsAsRead(userId);
        return res.success(result, "Đã đánh dấu tất cả thông báo là đã đọc");
    } catch (error) {
        next(error);
    }
});

/**
 * 3. PUT /api/v1/notifications/:id/read
 * Đánh dấu 1 thông báo cụ thể là đã đọc
 */
router.put("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const notificationId = req.params.id as string;
        const result = await markNotificationAsRead(userId, notificationId);
        return res.success(result, "Đã đánh dấu thông báo là đã đọc");
    } catch (error) {
        next(error);
    }
});

/**
 * 4. DELETE /api/v1/notifications/clear-all
 * Xoá tất cả thông báo
 */
router.delete("/clear-all", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const result = await clearAllNotifications(userId);
        return res.success(result, "Đã xoá toàn bộ thông báo");
    } catch (error) {
        next(error);
    }
});
