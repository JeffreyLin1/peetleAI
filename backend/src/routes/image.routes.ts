import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { ImageController, imageUpload } from '../controllers/image.controller';

const router = Router();
const imageController = new ImageController();

// Create auth middleware instance
let authMiddleware: AuthMiddleware;

function getAuthMiddleware() {
  if (!authMiddleware) {
    authMiddleware = new AuthMiddleware();
  }
  return authMiddleware;
}

/**
 * Upload image for a placeholder
 * POST /api/images/upload
 */
router.post(
  '/upload',
  (req, res, next) => getAuthMiddleware().authenticate(req, res, next),
  imageUpload.single('image'),
  (req, res) => imageController.uploadImage(req, res)
);

/**
 * Delete uploaded image
 * DELETE /api/images/delete
 */
router.delete(
  '/delete',
  (req, res, next) => getAuthMiddleware().authenticate(req, res, next),
  (req, res) => imageController.deleteImage(req, res)
);

export default router; 