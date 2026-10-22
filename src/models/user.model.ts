import mongoose from "mongoose";
export enum genderEnum {
    Male = "Male",
    Female = "Female"
}
import { baseSchema } from "./base.model.js";

const Schema = mongoose.Schema;
const userSchema = new Schema({
    username: String,
    gender: {
        type: String,
        enum: [genderEnum.Male, genderEnum.Female],
        default: genderEnum.Female,
        trim: true
    },
    avatar: String,
    phone: { type: Number, default: null },
    address: { type: String, default: null },
    role: { type: String, default: "EU" },
    local: {
        email: { type: String, trim: true },
        password: { type: String, trim: true },
        verifyToken: String,
        is_active: Boolean
    },
    facebook: {
        id: String,
        token: String,
        email: { type: String, trim: true },
        phone: { type: Number, default: null },

    },
    google: {
        id: String,
        token: String,
        email: { type: String, trim: true },
    },

})
userSchema.add(baseSchema)
const User = mongoose.model('User', userSchema);
export default User;