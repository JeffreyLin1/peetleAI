import express from 'express';
import { ContentController } from '../controllers/content.controller';
import { AuthMiddleware } from '../middleware/auth';

const router = express.Router();
const contentController = new ContentController();

// Lazy initialization to ensure environment variables are loaded
let authMiddleware: AuthMiddleware;

function getAuthMiddleware() {
  if (!authMiddleware) {
    authMiddleware = new AuthMiddleware();
  }
  return authMiddleware;
}

/**
 * Generate dialogue content from a topic
 * POST /api/content/generate
 */
router.post(
  '/generate',
  (req, res, next) => getAuthMiddleware().authenticate(req, res, next),
  (req, res) => contentController.generateContent(req, res)
);

export { router as contentRouter }; 