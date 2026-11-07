import mongoose, { Schema } from "mongoose";
import { baseSchema } from "./base.model.js";

export const ConversationType = {
    DIRECT: "direct",
    GROUP: "group",
} as const;

export type ConversationTypeValue = (typeof ConversationType)[keyof typeof ConversationType];

const conversationSchema = new Schema({
    name: {
        type: String,
        default: null,
        trim: true,
    },
    avatar: {
        type: String,
        default: null,
    },
    type: {
        type: String,
        enum: ["direct", "group"],
        default: "direct",
    },
    theme: {
        type: String,
        default: null,
    },
    background: {
        url: {
            type: String,
            default: null,
        },
        gradient: {
            type: String,
            default: null,
        }
    },
    participants: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    ],
    creatorId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    lastMessage: {
        messageId: {
            type: Schema.Types.ObjectId,
            ref: "Message",
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        content: {
            type: String,
            default: "",
        },
        type: {
            type: String,
            enum: ["text", "image", "file", "sticker"],
            default: "text",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    unreadCounts: {
        type: Map,
        of: Number,
        default: {},
    },
    deletedFor: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    ],
});

conversationSchema.add(baseSchema);

// Đánh Index để query nhanh
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
