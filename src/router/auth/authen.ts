import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { IAuthLogin, IcreateUser } from "../../interfaces/index.js";
import { createUsers, getMe, handleLogin, handleRefreshToken, logout, verifyEmail, verifyTokenUser, handleFacebookLogin, handleGoogleLogin, handleUpdateProfile } from "../../controller/index.js";
import { AppError } from "../../common/appError.js";
import { validateRequest } from "../../middleware/validate/validate.middleware.js";
import { registerSchema, loginSchema } from "../../validate/index.js";
import { authMiddleware } from "../../middleware/auth/verifyToken.js";
import { uploadAvatarMiddleware } from "../../config/cloudinary.js";
import { handleUpdateAvatar } from "../../controller/upload/upload.controller.js";


export const router: Router = Router();

router.post("/login", validateRequest(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as IAuthLogin;
        const user = await handleLogin({ email, password });
        return res.success(user, "Đăng nhập thành công");
    } catch (error) {
        next(error);
    }
});



router.post("/facebook", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) {
            throw new AppError("Thiếu accessToken của Facebook", 400);
        }
        const result = await handleFacebookLogin(accessToken);
        return res.success(result, "Đăng nhập Facebook thành công");
    } catch (error) {
        next(error);
    }
});

router.post("/google", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) {
            throw new AppError("Thiếu accessToken của Google", 400);
        }
        const result = await handleGoogleLogin(accessToken);
        return res.success(result, "Đăng nhập Google thành công");
    } catch (error) {
        next(error);
    }
});


router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            throw new AppError("Bạn chưa đăng nhập hoặc thiếu token", 401);
        }
        const user = await getMe(token); // Đã thêm await
        return res.success(user, "Lấy thông tin thành công");
    } catch (error) {
        next(error);
    }
});

router.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            throw new AppError("Bạn chưa đăng nhập hoặc thiếu token", 401);
        }
        const user = await logout(token); // Đã thêm await
        return res.success(user, "Đăng xuất thành công");
    } catch (error) {
        next(error);
    }
})

router.post("/refresh-token", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken = req.body.refreshToken;
        const user = await handleRefreshToken(refreshToken);
        return res.success(user, "Refresh token thành công");
    } catch (error) {
        next(error);
    }
})

router.post("/create-user", async (req: Request, res: Response, next: NextFunction) => {

    try {
        const params = req.body as IcreateUser;
        const result = await createUsers(params)
        return res.success(result, "User created successfully")
    }
    catch (error) {
        next(error);
    }
})

router.post("/register", validateRequest(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const params = req.body as IcreateUser;
        const user = await createUsers(params);
        return res.success(user, "Đăng ký thành công");
    } catch (error) {
        next(error);
    }
})

router.post("/verify-email", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.body.email;
        const user = await verifyEmail(token);
        return res.success(user, "Email verified successfully");
    } catch (error) {
        next(error);
    }
})

router.get("/verify-email/:token", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.params.token as string;
        const user = await verifyTokenUser(token);
        return res.success(user, "Email verified successfully");
    } catch (error) {
        next(error);
    }
})

router.put("/avatar",
    authMiddleware,
    uploadAvatarMiddleware.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                throw new AppError("Không tìm thấy file", 400);
            }
            const userId = req.user.userId || req.user._id?.toString() || req.user.id;
            const result = await handleUpdateAvatar(userId, req.file.buffer);
            return res.success(result, "Avatar updated successfully");
        } catch (error) {
            next(error);
        }
    }
);

router.put("/profile",
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user.userId || req.user._id?.toString() || req.user.id;
            const { username, gender, phone, address } = req.body;
            const updatedUser = await handleUpdateProfile(userId, { username, gender, phone, address });
            return res.success(updatedUser, "Cập nhật thông tin thành công");
        } catch (error) {
            next(error);
        }
    }
);

