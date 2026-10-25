import mongoose from "mongoose";

export const convertObjectId = (id: string) => {
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    if (!isValidObjectId) {
        throw new Error("Invalid ObjectId");
    }
    return new mongoose.Types.ObjectId(id);
};

/**
 * Lấy ID của người đối phương từ 1 bản ghi Contact
 */
export const getOtherUserId = (contact: any, currentUserId: string): string => {
    return contact?.userId?.toString() === currentUserId.toString()
        ? contact?.contactId?.toString()
        : contact?.userId?.toString();
};

/**
 * Lấy danh sách ObjectId của người đối phương từ mảng contacts
 * @param includeSelf Nếu true thì mảng trả về sẽ bao gồm cả currentUserId (dùng cho loại trừ $nin)
 */
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