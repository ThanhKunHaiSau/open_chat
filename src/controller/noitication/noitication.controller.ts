import type { ICreateNoitication } from "../../interfaces/index.js";
import Notification from "../../models/noitification.model.js";

/**
 * 1. Tạo thông báo mới
 */
export const createNoitication = async (data: ICreateNoitication) => {
    try {
        const notif = await Notification.create({
            sender: data.sender,
            receiver: data.receiver,
            content: data.content,
            type: data.type,
            isRead: data.isRead ?? false,
        });
        return notif;
    } catch (e: any) {
        throw new Error(e.message);
    }
};

/**
 * 2. Lấy danh sách thông báo của user (phân trang & sắp xếp mới nhất)
 */
export const getNotifications = async (
    userId: string,
    query?: { page?: string | number; limit?: string | number }
) => {
    try {
        const page = Math.max(1, Number(query?.page) || 1);
        const limit = Math.max(1, Number(query?.limit) || 20);
        const skip = (page - 1) * limit;

        const filter = {
            "receiver.id": userId,
            deletedAt: null,
        };

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter),
            Notification.countDocuments({
                ...filter,
                isRead: false,
            }),
        ]);

        return {
            notifications,
            total,
            unreadCount,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (e: any) {
        throw new Error(e.message);
    }
};

/**
 * 3. Đánh dấu 1 thông báo là đã đọc
 */
export const markNotificationAsRead = async (userId: string, notificationId: string) => {
    try {
        const updated = await Notification.findOneAndUpdate(
            { _id: notificationId, "receiver.id": userId, deletedAt: null },
            { isRead: true, updatedAt: new Date() },
            { new: true }
        );
        return updated;
    } catch (e: any) {
        throw new Error(e.message);
    }
};

/**
 * 4. Đánh dấu tất cả thông báo của user là đã đọc
 */
export const markAllNotificationsAsRead = async (userId: string) => {
    try {
        const result = await Notification.updateMany(
            { "receiver.id": userId, isRead: false, deletedAt: null },
            { isRead: true, updatedAt: new Date() }
        );
        return result;
    } catch (e: any) {
        throw new Error(e.message);
    }
};

/**
 * 5. Xoá mềm toàn bộ thông báo của user
 */
export const clearAllNotifications = async (userId: string) => {
    try {
        const result = await Notification.updateMany(
            { "receiver.id": userId, deletedAt: null },
            { deletedAt: new Date() }
        );
        return result;
    } catch (e: any) {
        throw new Error(e.message);
    }
};