import mongoose, { Schema } from "mongoose";
import { baseSchema } from "./base.model.js";

const messageSchema = new Schema({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true,
    },
    senderId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    receiverId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    content: {
        type: String,
        default: "",
        trim: true,
    },
    type: {
        type: String,
        enum: ["text", "image", "file"],
        default: "text",
    },
    file: {
        url: { type: String, default: null },
        fileName: { type: String, default: null },
        fileSize: { type: Number, default: 0 },
        contentType: { type: String, default: null },
    },
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent",
    },
    readBy: [
        {
            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
            readAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    replyTo: {
        type: Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
    deletedFor: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    ],
});

messageSchema.add(baseSchema);

// Đánh Index kép để query 20 tin nhắn mới nhất siêu nhanh
messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
