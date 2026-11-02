import { AppError } from "../../common/appError.js";
import { redisService } from "../../common/redis.service.js";
import cloudinary from "../../config/cloudinary.js";
import User from "../../models/user.model.js";
import { handleUploadFile } from "../common/filehelper.controller.js";

export const handleUpdateAvatar = async (userId: string, fileBuffer: Buffer) => {
    // Upload buffer ảnh lên Cloudinary kèm tính năng tự động crop tròn và nén
    const uploadResult = await handleUploadFile("open_chat/avatar", fileBuffer, { isAvatar: true });

    const avatarUrl = uploadResult.secure_url;

    // 2. Cập nhật vào MongoDB
    const user = await User.findByIdAndUpdate(userId, { avatar: avatarUrl }, { returnDocument: 'after' });
    if (!user) throw new AppError("Không tìm thấy user", 404);

    // 3. Cập nhật lại Cache trong Redis
    const userIdStr = user._id.toString();
    const cachedUser = await redisService.getUserCache(userIdStr);
    const userInfo = {
        userId: user._id,
        email: user?.local?.email || user?.google?.email || user?.facebook?.email,
        username: user?.username,
        gender: user?.gender,
        role: user?.role,
        phone: user?.phone || null,
        address: user?.address || "",
        ...(cachedUser || {}),
        avatar: avatarUrl,
    };
    await redisService.setUserCache(userIdStr, userInfo);

    return {
        avatar: avatarUrl,
        user: userInfo,
        message: "Cập nhật avatar thành công!"
    };
};
