import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../../common/appError.js';
import { addFriend, getAllContact, getRequestFriend, updateStatus } from '../../controller/contact/contact.controller.js';

export const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.userId;
    if (!userId) {
        return []
    }
    const query = req?.query?.name || undefined;
    const contacts = await getAllContact(userId, query);
    return res.status(200).json("heloo")

});

router.post("/add-friend", async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.userId;
    const contactId = req.body.contactId;
    const contacts = await addFriend(userId, contactId);
    return res.success(contacts, "Thêm bạn thành công");

})

router.put("/respone", async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.userId;
    const contactId = req.body.contactId;
    const status = req.body.status;
    const contacts = await updateStatus(userId, contactId, status);
    return res.success(contacts, "Update status thành công");

})

