import bcrypt from "bcryptjs";
import type { IAuthLogin, IcreateUser } from "../../interfaces/index.js";
import User, { genderEnum } from "../../models/user.model.js";
import { signToken, verifyToken } from "../../common/auth.common.js";
import { AppError } from "../../common/appError.js";
import { redisService } from "../../common/redis.service.js";
import validate from 'deep-email-validator';
import { v4 as uuidv4 } from 'uuid';
import { sendMail, sendVerificationEmail } from "../../config/mailer.js";
import mongoose from "mongoose";

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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const isExist = await User.findOne({ 'local.email': params.email, deletedAt: null });
        if (isExist && isExist?.local?.is_active) {

            throw new AppError("Email đã tồn tại", 400);
        } else if (isExist && !isExist?.local?.is_active) {
            throw new AppError("Tài khoản đã được tạo nhưng chưa được active, vui lòng kiểm tra email để active tài khoản", 400);
        }
        const hashPass = await bcrypt.hash(params.password, 12);
        const verifyToken = uuidv4();
        const user = {
            username: params.username,
            local: {
                email: params.email,
                password: hashPass,
                is_active: false,
                verifyToken
            },
            gender: (params?.gender as genderEnum) || genderEnum.Male,
            role: params?.role || "EU",
            address: params?.address || "",
            avatar: params?.avatar || ""
        };
        const createUser = await User.create({
            ...user
        });

        try {
            await sendVerificationEmail({
                to: params.email,
                username: params.username,
                verifyToken
            })
        } catch (emailError) {
            console.error("Lỗi gửi email:", emailError);
            throw new AppError("Gửi email xác thực thất bại. Vui lòng thử lại sau!", 503);
        }


        await session.commitTransaction();
        return createUser;

    } catch (error) {
        await session.abortTransaction();
        if (error instanceof AppError) throw error;
        throw new AppError("Tạo user thất bại", 400);
    } finally {
        // 6. Luôn đóng session sau khi xong
        session.endSession();
    }
}

export const verifyEmail = async (email: string) => {
    const res = await validate({
        email: email.trim(),
        validateRegex: true,
        validateMx: true,          // Kiểm tra domain có nhận mail không
        validateTypo: true,        // Bắt lỗi gõ sai tên miền phổ biến
        validateDisposable: true,  // Chặn mail rác 10 phút
        validateSMTP: false,       // ⚠️ Nên để false khi chạy ở localhost (xem lưu ý bên dưới)
    });
    if (!res.valid) {
        throw new AppError(`Email không hợp lệ: ${res.reason}`, 400);
    }
    return true;
};

export const logout = async (token: string) => {
    const decode = verifyToken(token);
    const id = (decode as any)?.userId as string;
    await redisService.removeUserCache(id);
    await redisService.removeRefreshToken(id);
    return true;
};

export const verifyTokenUser = async (token: string) => {
    const tokenUser = token.trim();
    const user = await User.findOneAndUpdate({ 'local.verifyToken': tokenUser },
        {
            "local.verifyToken": null,
            "local.is_active": true
        }, { new: true });
    if (!user) {
        throw new AppError("Không tìm thấy thông tin người dùng hoặc tài khoản đã được kích hoạt trước đó", 404);
    }
    const userInfor = {
        userId: user._id,
        email: user?.local?.email,
        username: user?.username,
        gender: user?.gender,
        role: user?.role,
    }
    return userInfor;
}
