import type { Application } from "express";
import config from "../config/index.js";

import { router as authRouter } from "./auth/authen.js";
import { router as contactRouter } from "./contact/contact.js";
import { authMiddleware } from "../middleware/auth/verifyToken.js";
import { router as userRouter } from "./auth/user.route.js";

export const initRouter = (app: Application) => {
    app.use(`${config.route.prefix}/auth`, authRouter);
    app.use(`${config.route.prefix}/contacts`, authMiddleware, contactRouter);
    app.use(`${config.route.prefix}/users`, authMiddleware, userRouter);
};

export default initRouter;
