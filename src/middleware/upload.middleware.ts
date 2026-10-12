import multer from "multer";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_PHOTO_SIZE_BYTES } from "../config/storage.config.js";
import { HttpError } from "./validation.js";

const storage = multer.memoryStorage();

export const uploadCustomerPhotoMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_PHOTO_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(new HttpError(415, `Unsupported file format: ${file.mimetype}. Allowed: image/jpeg, image/png, image/webp`));
      return;
    }
    cb(null, true);
  },
}).fields([
  { name: "photo", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);
