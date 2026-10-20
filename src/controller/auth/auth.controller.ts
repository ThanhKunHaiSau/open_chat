import bcrypt from "bcryptjs";
import type { IAuthLogin, IcreateUser } from "../../interfaces/index.js";
import User, { genderEnum } from "../../models/user.model.js";
import { signToken } from "../../common/auth.common.js";
import { AppError } from "../../common/appError.js";
import { redisService } from "../../common/redis.service.js";

export const handleLogin = async (params: IAuthLogin) => {
    const { email, password } = params;
    const user = await User.findOne({ 'local.email': email }).select("+local.password").exec();
    console.log("check user login", user);
    if (!user) {
        throw new AppError("Không tìm thấy user");
    }
    const isPasswordValid = await bcrypt.compare(password, user?.local?.password || "test");
    const accessToken = signToken({ userId: user._id, role: user.role });
    const refreshToken = signToken({ userId: user._id }, "7d");
    console.log('check abd', refreshToken);
    console.log("check accc", accessToken);
    // Lưu vào Redis (cực nhanh < 1ms)
    const userIdStr = user._id.toString();
    await redisService.setRefreshToken(userIdStr, refreshToken);
    await redisService.setUserCache(userIdStr, user);
    return {
        user,
        accessToken,
        refreshToken
    };
    console.log("check is password valid", isPasswordValid)
    if (!isPasswordValid) {
        throw new AppError("Sai mật khẩu");
    }
    return user;
}

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