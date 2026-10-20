import type { Application } from "express";
import config from "../config/index.js";

import { router as authRouter } from "./auth/authen.js";

export const initRouter = (app: Application) => {
    app.use(`${config.route.prefix}/auth`, authRouter);
};

export default initRouter;
