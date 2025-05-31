import { Request, Response } from 'express';
import multer from 'multer';
import { ImageService } from '../services/image';
import { ImageUploadResponse } from '../types/video.types';
import { sendSuccess, sendError, sendValidationError } from '../utils/response';
import { ERROR_MESSAGES } from '../config/constants';

export class ImageController {
  private imageService: ImageService;

  constructor() {
    this.imageService = new ImageService();
  }

  /**
   * Upload image for a placeholder
   * POST /api/images/upload
   */
  async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      const { placeholder } = req.body;
      const file = req.file;
      const userId = (req as any).user?.id; // Get user ID from authenticated request

      if (!file) {
        sendValidationError(res, 'No image file provided');
        return;
      }

      if (!placeholder) {
        sendValidationError(res, 'Placeholder name is required');
        return;
      }

      // Validate the image file
      this.imageService.validateImageFile(file.buffer, file.originalname);

      // Save the image with user ID for cloud storage organization
      const imagePath = await this.imageService.saveImageForPlaceholder(
        file.buffer,
        placeholder,
        file.originalname,
        userId
      );

      const response: ImageUploadResponse = {
        success: true,
        imagePath,
        placeholder
      };

      sendSuccess(res, response);
    } catch (error) {
      console.error('Image upload error:', error);
      sendError(
        res,
        ERROR_MESSAGES.UPLOAD_FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Delete uploaded image
   * DELETE /api/images/:placeholder
   */
  async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const { imagePath } = req.body;

      if (!imagePath) {
        sendValidationError(res, 'Image path is required');
        return;
      }

      await this.imageService.deleteImage(imagePath);

      sendSuccess(res, { success: true });
    } catch (error) {
      console.error('Image deletion error:', error);
      sendError(res, 'Failed to delete image');
    }
  }
}

// Configure multer for image uploads
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, GIF, and WebP images are allowed.'));
    }
  },
}); 