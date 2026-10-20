import bcrypt from "bcryptjs";
import type { IAuthLogin, IcreateUser } from "../../interfaces/index.js";
import User, { genderEnum } from "../../models/user.model.js";
import { signToken } from "../../common/auth.common.js";
import { AppError } from "../../common/appError.js";

export const handleLogin = async (params: IAuthLogin) => {
    const { username, password } = params;
    console.log(username, password);
    const user = await User.findOne({ username }).select("+password").exec();
    if (!user) {
        throw new Error("User not found");
    }
    const isPasswordValid = await bcrypt.compare(password, user?.local?.password || "test");
    if (!isPasswordValid) {
        throw new Error("Invalid password");
    }
    return user;
}

export const createUsers = async (params: IcreateUser) => {
    const hashPass = await bcrypt.hash(params.password, 12);
    console.log("check the anh", hashPass)
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
    console.log("check token ", signToke)

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