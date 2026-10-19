import mongoose from "mongoose";
import { baseSchema } from "./base.model.js";

const Schema = mongoose.Schema;
const messageSchema = new Schema({
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
    text: String,
    file: { data: Buffer, contentType: String, fileName: String },
})
messageSchema.add(baseSchema)
const Message = mongoose.model('Message', messageSchema);
export default Message;