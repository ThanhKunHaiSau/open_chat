import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../common/auth.common.js";
import User from "../../models/user.model.js";
import { redisService } from "../../common/redis.service.js";
// Mở rộng kiểu Request để TS nhận diện req.user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1]; // Lấy token sau chữ "Bearer"

        if (!token) {
            return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
        }
        // 1. Giải mã token lấy userId
        const decoded: any = verifyToken(token);
        // 2. Lấy user info (Ưu tiên lấy từ Redis, nếu chưa có thì tìm trong MongoDB)
        let user = await redisService.getUserCache(decoded.userId);
        if (!user) {
            user = await User.findById(decoded.userId);
            if (!user)

                return res.status(404).json({ message: "Người dùng không tồn tại!" });
        }
        await redisService.setUserCache(decoded.userId, user);
        // 3. GẮN VÀO REQ ĐỂ CÁC CONTROLLER PHÍA SAU XÀI:
        req.user = user;

        next();
    } catch (error) {
        return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
    }
};
