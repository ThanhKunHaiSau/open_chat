import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { IAuthLogin, IAuthRegister, IcreateUser } from "../../interfaces/index.js";
import { createUsers, getMe, handleLogin, handleRefreshToken, logout, verifyEmail, verifyTokenUser } from "../../controller/index.js";
import { AppError } from "../../common/appError.js";
import { validateRequest } from "../../middleware/validate/validate.middleware.js";
import { registerSchema, loginSchema } from "../../validate/index.js";


export const router: Router = Router();

router.post("/login", validateRequest(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as IAuthLogin;
        console.log("check login", email, password);
        const user = await handleLogin({ email, password });
        return res.success(user, "Đăng nhập thành công");
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
        console.log("check register", params);
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