import { Router, type NextFunction, type Request, type Response } from "express";
import { fetchAllUser, getFriend, getRequestAddFriend } from "../../controller/index.js";
import { AppError } from "../../common/appError.js";
import { getRequestFriendSchema } from "../../validate/user.validate.js";

export const router = Router();

router.get("/all-user", async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.userId;
    if (!userId) return;
    const name = req?.query?.name as string;
    const page = Number(req?.query?.page) || 1;
    const limit = Number(req?.query?.limit) || 10;
    const params = {
        userId: userId,
        name: name,
        limit: limit,
        page: page
    };

    const result = await fetchAllUser(params);
    return res.success(result, "Get all user successfully");
});

router.get("/request",
    //  getRequestFriendSchema,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user.userId;
            const type = req.query.type as string;
            const contacts = await getRequestAddFriend(userId, type);
            return res.success(contacts, "Get request friend thành công");
        } catch (error: any) {
            next(new AppError(error.message, error.statusCode || 500));
        }

    });

router.get("/friend",

    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user.userId;
            const contacts = await getFriend(userId);
            return res.success(contacts, "Get friend successfully");
        } catch (error: any) {
            next(new AppError(error.message, error.statusCode || 500));
        }
    }
)