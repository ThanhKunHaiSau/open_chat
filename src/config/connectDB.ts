import mongoose from "mongoose";
import logger from "./logger.js";
import config from "./index.js";
/**
 * connect db mongo
 */
const connectDB = async () => {
    try {
        let url = config.mongodb.uri;
        if (!url) {
            if (config.mongodb.username && config.mongodb.password) {
                url = `${config.mongodb.connection}://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}:${config.mongodb.port}/${config.mongodb.name}`;
            } else {
                url = `${config.mongodb.connection}://${config.mongodb.host}:${config.mongodb.port}/${config.mongodb.name}`;
            }
        }
        await mongoose.connect(url);
        logger.info("Connect to MongoDB successfully!");
    } catch (error) {
        logger.error(`Connect to MongoDB failed: ${error}`);
    }
}
export default connectDB;