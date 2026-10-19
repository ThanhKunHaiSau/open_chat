import mongoose from "mongoose";
import { baseSchema } from "./base.model.js";

const Schema = mongoose.Schema;
const chatGroupSchema = new Schema({
    id: String,
    name: String,
    userAmount: { type: Number, min: 2, max: 100 },
    messageAmount: { type: Number, default: 0 },
    userId: String,
    members: [
        { userId: String }
    ]
})
chatGroupSchema.add(baseSchema)
const ChatGroup = mongoose.model('ChatGroup', chatGroupSchema);
export default ChatGroup;