import { Router, type NextFunction, type Request, type Response } from "express";
import { handleUploadImage, handleUploadDocumentFile } from "../../controller/index.js";
import { uploadAvatarMiddleware, uploadFileMiddleware } from "../../config/cloudinary.js";
import { AppError } from "../../common/appError.js";
import { validateRequest } from "../../middleware/validate/validate.middleware.js";
import { validateMessage } from "../../validate/index.js";
export const router = Router();

router.post(
    "/upload-image",
    uploadAvatarMiddleware.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                throw new AppError("Không tìm thấy file ảnh", 400);
            }
            const { conversationId } = req.body;
            if (!conversationId) {
                throw new AppError("conversationId là bắt buộc", 400);
            }

            const userId = req.user.userId || req.user._id?.toString() || req.user.id;
            const io = req.app.get("io");

            const data = await handleUploadImage({
                file: req.file.buffer,
                conversationId,
                userId,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                io,
            });

            return res.success(data, "Gửi hình ảnh thành công");
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    "/upload-file",
    uploadFileMiddleware.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                throw new AppError("Không tìm thấy file tài liệu", 400);
            }
            const { conversationId } = req.body;
            if (!conversationId) {
                throw new AppError("conversationId là bắt buộc", 400);
            }
            const userId = req.user.userId || req.user._id?.toString() || req.user.id;
            const io = req.app.get("io");

            const data = await handleUploadDocumentFile({
                file: req.file.buffer,
                conversationId,
                userId,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                io,
            });

            return res.success(data, "Gửi tệp tin thành công");
        } catch (error) {
            next(error);
        }
    }
);

// router.get("/message-file",
//     validateRequest(validateMessage),
//     async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const conversationId = req.params.conversationId;
//             if (!conversationId) {
//                 throw new AppError("conversationId là bắt buộc", 400);
//             }

//             const data = await findMessageFile(conversationId)
//             return res.success(data, "Gửi hình ảnh thành công");
//         } catch (error) {
//             next(error);

//         }
//     })
export default router;
