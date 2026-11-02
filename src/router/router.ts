import type { Application } from "express";
import config from "../config/index.js";

import { router as authRouter } from "./auth/authen.js";
import { router as contactRouter } from "./contact/contact.js";
import { authMiddleware } from "../middleware/auth/verifyToken.js";
import { router as userRouter } from "./auth/user.route.js";
import { router as notificationRouter } from "./notification/notification.route.js";
import { router as conversationRouter } from "./conversation/conversation.rotuer.js"
import { router as messageationRouter } from "./messages/message.router.js"

export const initRouter = (app: Application) => {
    app.use(`${config.route.prefix}/auth`, authRouter);
    app.use(`${config.route.prefix}/contacts`, authMiddleware, contactRouter);
    app.use(`${config.route.prefix}/users`, authMiddleware, userRouter);
    app.use(`${config.route.prefix}/notifications`, authMiddleware, notificationRouter);
    app.use(`${config.route.prefix}/conversations`, authMiddleware, conversationRouter);
    app.use(`${config.route.prefix}/messages`, authMiddleware, messageationRouter);
};

export default initRouter;
