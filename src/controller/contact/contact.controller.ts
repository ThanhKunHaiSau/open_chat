import mongoose from "mongoose";
import { convertObjectId, extractOtherUserObjectIds } from "../common/common.controller.js";
import Contact from "../../models/contact.model.js";

export const getAllContact = async (userId: string, query?: any) => {
    try {
        const filter = {
            _id: { $ne: userId }
        }
        // if (query) {
        //     filter.name
        // }

        return;
    } catch (error: any) {
        throw new Error(
            error
        )
    }
}

export const addFriend = async (userId: string, contactId: string) => {
    try {
        const existingContact = await Contact.findOne({
            $or: [
                { userId: userId, contactId: contactId },
                { userId: contactId, contactId: userId }
            ],
            deletedAt: null
        });
        if (existingContact) {
            throw new Error("Bạn đã là bạn với người này!");
        }
        const contact = await Contact.create({
            userId,
            contactId
        });
        return contact;
    } catch (error: any) {
        throw new Error(
            error
        )
    }
}

export const updateStatus = async (userId: string, contactId: string, status: boolean) => {
    try {
        const existingContact = await Contact.findOne({
            $or: [
                { userId: userId, contactId: contactId },
                { userId: contactId, contactId: userId }
            ],

            deletedAt: null
        });
        if (!existingContact) {
            throw new Error("Không tìm thấy người bạn này!");
        }
        const updateData: Record<string, any> = {
            status: Boolean(status),
            updatedAt: new Date(),
        };
        if (!status) {
            updateData.deletedAt = new Date();
        }
        const contact = await Contact.findByIdAndUpdate(
            existingContact._id,
            { $set: updateData },
            { returnDocument: 'after' }
        );
        if (!contact) {
            throw new Error("Update thất bại!");
        }
        return contact;
    } catch (error: any) {
        throw new Error(
            error
        )
    }
}

export const findAddedFriend = async (userId: string) => {
    try {
        const contacts = await Contact.find({
            $or: [
                { userId: userId },
                { contactId: userId }
            ],
            status: true,
            deletedAt: null
        }).select("userId contactId status");
        return extractOtherUserObjectIds(contacts, userId, true);
    } catch (error: any) {
        throw new Error(
            error.message || error
        )
    }
}

export const getRequestFriend = async (userId: string, type: string) => {
    try {
        if (!type) {
            throw new Error("Type is required");
        }
        let query = {};
        if (type === "receive") {
            query = {
                contactId: userId,
                status: false,
                deletedAt: null
            };
        } else if (type === "sent") {
            query = {
                userId: userId,
                status: false,
                deletedAt: null
            };
        }
        const contacts = await Contact.find(query).select("userId contactId status");
        const excludeIds: mongoose.Types.ObjectId[] = [];
        contacts.forEach((contact: any) => {
            const otherId = type === "sent" ? contact?.contactId?.toString() : contact?.userId?.toString();
            if (otherId && mongoose.Types.ObjectId.isValid(otherId)) {
                excludeIds.push(convertObjectId(otherId));
            }
        });
        return excludeIds;
    } catch (error: any) {
        throw new Error(
            error
        )
    }
}

export const getFriendContract = async (userId: string) => {
    try {
        const contacts = await Contact.find({
            $or: [
                { userId: userId },
                { contactId: userId }
            ],
            status: true,
            deletedAt: null
        }).select("userId contactId status");
        return extractOtherUserObjectIds(contacts, userId, false);
    } catch (error: any) {
        throw new Error(
            error
        )
    }
}