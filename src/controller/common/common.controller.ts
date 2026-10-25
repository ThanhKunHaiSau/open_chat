import mongoose from "mongoose";

export const convertObjectId = (id: string) => {
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    if (!isValidObjectId) {
        throw new Error("Invalid ObjectId");
    }
    return new mongoose.Types.ObjectId(id);
};


export const getOtherUserId = (contact: any, currentUserId: string): string => {
    return contact?.userId?.toString() === currentUserId.toString()
        ? contact?.contactId?.toString()
        : contact?.userId?.toString();
};


export const extractOtherUserObjectIds = (
    contacts: any[],
    currentUserId: string,
    includeSelf: boolean = false
): mongoose.Types.ObjectId[] => {
    const ids: mongoose.Types.ObjectId[] = includeSelf
        ? [convertObjectId(currentUserId)]
        : [];

    contacts.forEach((contact: any) => {
        const otherId = getOtherUserId(contact, currentUserId);
        if (otherId && mongoose.Types.ObjectId.isValid(otherId)) {
            ids.push(convertObjectId(otherId));
        }
    });

    return ids;
};