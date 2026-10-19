import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const baseSchema = new Schema({
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null }
});
