import cloudinary from "../../config/cloudinary.js";

export const handleUploadFile = async (
    folderName: string,
    fileBuffer: Buffer,
    options?: {
        isAvatar?: boolean;
    }
) => {
    const uploadOptions: any = {
        folder: folderName,
        resource_type: "auto",
    };

    // Nếu là avatar thì crop vuông 250x250 và nhận diện khuôn mặt
    if (options?.isAvatar) {
        uploadOptions.transformation = [
            { width: 250, height: 250, crop: "fill", gravity: "face" },
            { format: "webp", quality: "auto" }
        ];
    } else {
        // Đối với ảnh tin nhắn: Giữ nguyên tỉ lệ gốc của ảnh và tự động nén nhẹ
        uploadOptions.transformation = [
            { quality: "auto", fetch_format: "auto" }
        ];
    }

    const uploadResult: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(fileBuffer);
    });

    return uploadResult;
};
