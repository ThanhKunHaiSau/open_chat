import mongoose from "mongoose";
import { baseSchema } from "./base.model.js";
const Schema = mongoose.Schema;
const contactSchema = new Schema({
    id: String,
    userId: String,
    status: { type: Boolean, default: false },
})
contactSchema.add(baseSchema);

const Contact = mongoose.model('Contact', contactSchema);
export default Contact;