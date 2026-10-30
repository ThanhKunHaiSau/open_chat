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
import http from "http"
import { Server } from "socket.io";
import { initSockets } from "./sockets/index.js";
const app = express();

//init server with socketio express

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
        methods: ["GET", "POST", "PUT"],
        credentials: true
    }
});


// Lắng nghe sự kiện kết nối của socket


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
//init sockets
initSockets(io)
//error handle
app.use(globalErrorHandler);

const port = config.server.port || 3000
server.listen(port, () => {
    logger.info(`Server is running on port http://localhost:${port}`);
});
