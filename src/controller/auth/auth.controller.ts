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
        email: user?.local?.email || user?.google?.email || user?.facebook?.email,
        username: user?.username,
        gender: user?.gender,
        role: user?.role,
        avatar: user?.avatar || "",
        phone: user?.phone || null,
        address: user?.address || "",
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
        email: user?.local?.email || user?.google?.email || user?.facebook?.email,
        username: user?.username,
        gender: user?.gender,
        role: user?.role,
        avatar: user?.avatar || "",
        phone: user?.phone || null,
        address: user?.address || "",
    }
    await redisService.setUserCache(id, userInfor);
    return userInfor;
}

export const handleUpdateProfile = async (
    userId: string,
    payload: { username?: string; gender?: genderEnum; phone?: number | string; address?: string }
) => {
    const updateData: any = {};
    if (payload.username !== undefined) updateData.username = payload.username.trim();
    if (payload.gender !== undefined) updateData.gender = payload.gender;
    if (payload.phone !== undefined) {
        const phoneNum = Number(payload.phone);
        updateData.phone = isNaN(phoneNum) ? null : phoneNum;
    }
    if (payload.address !== undefined) updateData.address = payload.address.trim();

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
    if (!updatedUser) {
        throw new AppError("Không tìm thấy người dùng", 404);
    }

    const userInfo = {
        userId: updatedUser._id,
        email: updatedUser?.local?.email || updatedUser?.google?.email || updatedUser?.facebook?.email,
        username: updatedUser?.username,
        gender: updatedUser?.gender,
        role: updatedUser?.role,
        avatar: updatedUser?.avatar || "",
        phone: updatedUser?.phone || null,
        address: updatedUser?.address || "",
    };

    // Cập nhật lại Cache trong Redis
    const userIdStr = updatedUser._id.toString();
    await redisService.setUserCache(userIdStr, userInfo);

    return userInfo;
};

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

export const handleFacebookLogin = async (fbAccessToken: string) => {
    // 1. Gọi Graph API của Facebook để lấy thông tin người dùng từ token
    const fbUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${fbAccessToken}`;
    const fbResponse = await fetch(fbUrl);
    const fbData = await fbResponse.json();

    if (!fbData || fbData.error) {
        throw new AppError(fbData?.error?.message || "Xác thực Facebook token thất bại", 400);
    }

    const { id, name, email, picture } = fbData;
    const avatarUrl = picture?.data?.url || "";

    // 2. Tìm xem user đã từng đăng nhập Facebook chưa
    let user = await User.findOne({ 'facebook.id': id, deletedAt: null });

    // Nếu chưa có facebook.id nhưng có email trùng với tài khoản Local -> liên kết tài khoản
    if (!user && email) {
        user = await User.findOne({ 'local.email': email, deletedAt: null });
        if (user) {
            user.facebook = { id, token: fbAccessToken, email };
            if (!user.avatar) user.avatar = avatarUrl;
            await user.save();
        }
    }

    // Nếu chưa từng có tài khoản -> Tạo mới User
    if (!user) {
        user = await User.create({
            username: name,
            avatar: avatarUrl,
            role: "EU",
            facebook: {
                id,
                token: fbAccessToken,
                email: email || undefined,
            },
            local: {
                email: email || undefined,
                is_active: true // Đăng nhập MXH thì tự động active luôn
            }
        });
    }

    // 3. Tạo AccessToken và RefreshToken của hệ thống OpenChat
    const accessToken = signToken({ userId: user._id, role: user.role });
    const refreshToken = signToken({ userId: user._id }, "7d");

    const userInfo = {
        userId: user._id,
        email: user?.local?.email || user?.facebook?.email,
        username: user?.username,
        gender: user?.gender,
        role: user?.role,
        avatar: user?.avatar || "",
        phone: user?.phone || null,
        address: user?.address || "",
    };

    // 4. Lưu Cache vào Redis
    const userIdStr = user._id.toString();
    await redisService.setRefreshToken(userIdStr, refreshToken);
    await redisService.setUserCache(userIdStr, userInfo);

    return {
        user: userInfo,
        accessToken,
        refreshToken
    };
};

export const handleGoogleLogin = async (googleAccessToken: string) => {
    // 1. Gọi Google UserInfo API để lấy thông tin từ access token
    const googleUrl = "https://www.googleapis.com/oauth2/v3/userinfo";
    const googleResponse = await fetch(googleUrl, {
        headers: {
            Authorization: `Bearer ${googleAccessToken}`
        }
    });
    const googleData = await googleResponse.json();

    if (!googleData || googleData.error || !googleData.sub) {
        throw new AppError(googleData?.error_description || googleData?.error || "Xác thực Google token thất bại", 400);
    }

    const { sub: id, name, email, picture } = googleData;
    const avatarUrl = picture || "";

    // 2. Tìm xem user đã từng đăng nhập Google chưa
    let user = await User.findOne({ 'google.id': id, deletedAt: null });

    // Nếu chưa có google.id nhưng có email trùng với tài khoản Local / Facebook -> liên kết tài khoản
    if (!user && email) {
        user = await User.findOne({
            $or: [
                { 'local.email': email },
                { 'facebook.email': email }
            ],
            deletedAt: null
        });
        if (user) {
            user.google = { id, token: googleAccessToken, email };
            if (!user.avatar) user.avatar = avatarUrl;
            await user.save();
        }
    }

    // Nếu chưa từng có tài khoản -> Tạo mới User
    if (!user) {
        user = await User.create({
            username: name,
            avatar: avatarUrl,
            role: "EU",
            google: {
                id,
                token: googleAccessToken,
                email: email || undefined,
            },
            local: {
                email: email || undefined,
                is_active: true // Đăng nhập Google thì tự động active luôn
            }
        });
    }

    // 3. Tạo AccessToken và RefreshToken của hệ thống OpenChat
    const accessToken = signToken({ userId: user._id, role: user.role });
    const refreshToken = signToken({ userId: user._id }, "7d");

    const userInfo = {
        userId: user._id,
        email: user?.local?.email || user?.google?.email || user?.facebook?.email,
        username: user?.username,
        gender: user?.gender,
        role: user?.role,
        avatar: user?.avatar || "",
        phone: user?.phone || null,
        address: user?.address || "",
    };

    // 4. Lưu Cache vào Redis
    const userIdStr = user._id.toString();
    await redisService.setRefreshToken(userIdStr, refreshToken);
    await redisService.setUserCache(userIdStr, userInfo);

    return {
        user: userInfo,
        accessToken,
        refreshToken
    };
};
