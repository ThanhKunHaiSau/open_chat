import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { IAuthLogin, IAuthRegister, IcreateUser } from "../../interfaces/index.js";
import { createUsers, handleLogin } from "../../controller/index.js";
import { authMiddleware } from "../../middleware/auth/verifyToken.js";


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