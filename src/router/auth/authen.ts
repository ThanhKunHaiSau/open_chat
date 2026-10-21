import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { IAuthLogin, IAuthRegister, IcreateUser } from "../../interfaces/index.js";
import { createUsers, getMe, handleLogin, handleRefreshToken } from "../../controller/index.js";
import { authMiddleware } from "../../middleware/auth/verifyToken.js";
import { AppError } from "../../common/appError.js";


export const router: Router = Router();

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
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

router.get("/test-redis",
    authMiddleware,
    (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        const userId = user?._id;
        const email = user?.local?.email;

        return res.success(user, "Test redis successfully");
    }
)