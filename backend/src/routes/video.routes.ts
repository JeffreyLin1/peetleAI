import express from 'express';
import { VideoController } from '../controllers/video.controller';
import { AuthMiddleware } from '../middleware/auth';

const router = express.Router();
const videoController = new VideoController();

// Lazy initialization to ensure environment variables are loaded
let authMiddleware: AuthMiddleware;

function getAuthMiddleware() {
  if (!authMiddleware) {
    authMiddleware = new AuthMiddleware();
  }
  return authMiddleware;
}

/**
 * Generate video from text and dialogue
 * POST /api/video/generate
 */
router.post(
  '/generate',
  (req, res, next) => getAuthMiddleware().authenticate(req, res, next),
  (req, res) => videoController.generateVideo(req, res)
);

/**
 * List available videos
 * GET /api/video/list
 */
router.get(
  '/list',
  (req, res) => videoController.listVideos(req, res)
);

/**
 * Stream video file with range support
 * GET /api/video/stream/:filename
 */
router.get(
  '/stream/:filename',
  (req, res) => videoController.streamVideo(req, res)
);

export { router as videoRouter }; 