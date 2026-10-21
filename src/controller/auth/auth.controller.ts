import bcrypt from "bcryptjs";
import type { IAuthLogin, IcreateUser } from "../../interfaces/index.js";
import User, { genderEnum } from "../../models/user.model.js";
import { signToken, verifyToken } from "../../common/auth.common.js";
import { AppError } from "../../common/appError.js";
import { redisService } from "../../common/redis.service.js";

export const handleLogin = async (params: IAuthLogin) => {
    const { email, password } = params;
    const user = await User.findOne({ 'local.email': email }).select("+local.password").exec();
    if (!user) {
        throw new AppError("Không tìm thấy user");
    }
    const isPasswordValid = await bcrypt.compare(password, user?.local?.password || "test");
    if (!isPasswordValid) {
        throw new AppError("Sai mật khẩu");
    }
    const accessToken = signToken({ userId: user._id, role: user.role });
    const refreshToken = signToken({ userId: user._id }, "7d");

    // Lưu vào Redis (cực nhanh < 1ms)
    const userInfo = {
        userId: user._id,
        email: user?.local?.email,
        username: user?.username,
        gender: user?.gender,
        role: user?.role,

    }
    const userIdStr = user._id.toString();
    await redisService.setRefreshToken(userIdStr, refreshToken);
    await redisService.setUserCache(userIdStr, userInfo);


    return {
        user: userInfo,
        accessToken,
        refreshToken
    };
}


export const getMe = async (token: string) => {
    const decode = verifyToken(token);
    const id = (decode as any)?.userId as string;
    const userRedis = await redisService.getUserCache(id);
    if (userRedis) {
        return userRedis;
    }
    const user = await User.findById(id);

    if (!user) {
        throw new AppError("Không tìm thấy thông tin người dùng", 404);
    }
    const userInfor = {
        userId: user._id,
        email: user?.local?.email,
        username: user?.username,
        gender: user?.gender,
        role: user?.role,
    }
    await redisService.setUserCache(id, userInfor);
    return userInfor;
}

export const handleRefreshToken = async (refreshToken: string) => {
    if (!refreshToken) {
        throw new AppError("Refresh token không được để trống", 401);
    }
    const decoded: any = verifyToken(refreshToken);
    const userId = decoded?.userId;
    if (!userId) {
        throw new AppError("Token không hợp lệ", 401);
    }
    const savedToken = await redisService.getRefreshToken(userId);
    if (!savedToken || savedToken !== refreshToken) {
        throw new AppError("Refresh token không hợp lệ hoặc đã bị thu hồi", 403);
    }
    let user = await redisService.getUserCache(userId);
    if (!user) {
        user = await User.findById(userId);
        if (!user) {
            throw new AppError("Người dùng không tồn tại", 404);
        }
    }
    const newAccessToken = signToken({ userId: user.userId || user._id, role: user.role });
    return {
        accessToken: newAccessToken,
    };
};

export const createUsers = async (params: IcreateUser) => {
    const hashPass = await bcrypt.hash(params.password, 12);
    const payload = {
        username: params.username,
        email: params.email,
        phone: params.phone,
        gender: params.gender,
        role: params.role,
        address: params.address,
        avatar: params.avatar
    }
    const signToke = signToken(payload)

    const user = {
        username: params.username,
        local: {
            email: params.email,
            password: hashPass,
            is_active: true,
            verifyToken: signToke
        },
        gender: (params?.gender as genderEnum) || genderEnum.Male,
        role: params?.role || "EU",
        address: params?.address || "",
        avatar: params?.avatar || ""
    }
    const createUser = await User.create({
        ...user
    })
    return user;
}