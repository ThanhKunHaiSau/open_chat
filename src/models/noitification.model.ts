import mongoose from "mongoose";
import { baseSchema } from "./base.model.js";

const Schema = mongoose.Schema;
const notificationSchema = new Schema({
    id: String,
    sender: {
        id: String,
        username: String,
        avatar: String
    },
    receiver: {
        id: String,
        username: String,
        avatar: String
    },
    type: String,
    content: String,
    isRead: { type: Boolean, default: false }

})
notificationSchema.add(baseSchema)
const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;