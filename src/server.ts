import express from "express";
import config from "./config/index.js";
import morgan from "morgan";
import cors from "cors";
import connectDB from "./config/connectDB.js";
import ContactModal from "./models/contact.model.js"
import logger from "./config/logger.js";
import initRouter from "./router/router.js";
import { globalErrorHandler } from "./middleware/error.middleware.js";
import responseMiddleware from "./middleware/response.middleware.js";
import type { IContactCreate } from "./interfaces/auth/contact/create.interface.js";

const app = express();
//conect to mongo
connectDB();
//body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//cors
app.use(cors());
//logger 
app.use(morgan("dev"));
//custom response
app.use(responseMiddleware);
// router
initRouter(app);
//error handle
app.use(globalErrorHandler);

app.get("/test-data", async (req, res) => {
    try {
        const item: IContactCreate = {
            userId: crypto.randomUUID(),
            contactId: crypto.randomUUID()
        }
        const contact = await ContactModal.create(item);
        res.status(200).json(contact);
    } catch (error) {
        logger.error(`Tạo contact thất bại: ${error}`);
        res.status(500).json({ message: error });
    }
});

const port = config.server.port || 3000
app.listen(port, () => {
    logger.info(`Server is running on port http://localhost:${port}`);
});
