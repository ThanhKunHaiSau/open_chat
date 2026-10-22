import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import dotenv from "dotenv";
import config from "./index.js";
dotenv.config();

// Cấu hình tài khoản Cloudinary
cloudinary.config({
    cloud_name: config.cloudinary.cloud_name!,
    api_key: config.cloudinary.api_key!,
    api_secret: config.cloudinary.api_secret!,
});

// Sử dụng MemoryStorage để lưu file tạm vào RAM dạng Buffer (cực nhanh và không tốn ổ cứng)
const storage = multer.memoryStorage();

export const uploadAvatarMiddleware = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn ảnh tối đa 5MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Chỉ được upload file hình ảnh!"));
        }
    },
});

export default cloudinary;
