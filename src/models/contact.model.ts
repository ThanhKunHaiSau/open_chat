import mongoose from "mongoose";
import { baseSchema } from "./base.model.js";
const Schema = mongoose.Schema;
const contactSchema = new Schema({
    id: String,
    contactId: String,
    userId: String,
    status: { type: Boolean, default: false },
})
contactSchema.add(baseSchema);
contactSchema.statics = {
    createNew(item) {
        return this.create(item)
    }
}
const Contact = mongoose.model('Contact', contactSchema);
export default Contact;