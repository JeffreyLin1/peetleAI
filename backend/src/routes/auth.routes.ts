import express from 'express';
import { SupabaseService } from '../services/supabase';
import { AuthMiddleware } from '../middleware/auth';
import { validateEmail, validatePassword, ValidationError } from '../utils/validation';
import { sendSuccess, sendError, sendValidationError, sendUnauthorized } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';

const router = express.Router();

// Lazy initialization to ensure environment variables are loaded
let supabaseService: SupabaseService;
let authMiddleware: AuthMiddleware;

function getSupabaseService() {
  if (!supabaseService) {
    supabaseService = new SupabaseService();
  }
  return supabaseService;
}

function getAuthMiddleware() {
  if (!authMiddleware) {
    authMiddleware = new AuthMiddleware();
  }
  return authMiddleware;
}

/**
 * Get current user information
 * GET /api/auth/me
 */
router.get('/me', (req, res, next) => getAuthMiddleware().authenticate(req, res, next), async (req, res) => {
  try {
    if (!req.user) {
      sendUnauthorized(res, 'User not found');
      return;
    }

    sendSuccess(res, { user: req.user });
  } catch (error) {
    sendError(
      res,
      'Failed to get user information',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

/**
 * Verify token validity
 * POST /api/auth/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      sendValidationError(res, 'Token is required and must be a valid string');
      return;
    }

    const user = await getSupabaseService().verifyToken(token);

    if (!user) {
      sendUnauthorized(res, 'The provided token is invalid or expired');
      return;
    }

    sendSuccess(res, {
      valid: true,
      user
    });
  } catch (error) {
    sendError(
      res,
      'Token verification failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

/**
 * Create a new user (admin only)
 * POST /api/auth/create-user
 */
router.post('/create-user', 
  (req, res, next) => getAuthMiddleware().authenticate(req, res, next),
  (req, res, next) => getAuthMiddleware().requireAdmin(req, res, next),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate input
      const validatedEmail = validateEmail(email);
      const validatedPassword = validatePassword(password);

      const user = await getSupabaseService().createUser(validatedEmail, validatedPassword);

      if (!user) {
        sendError(
          res,
          'Failed to create user',
          'User creation failed. Email might already be in use.',
          HTTP_STATUS.BAD_REQUEST
        );
        return;
      }

      sendSuccess(res, {
        user,
        message: 'User created successfully'
      }, HTTP_STATUS.CREATED);
    } catch (error) {
      if (error instanceof ValidationError) {
        sendValidationError(res, error.message);
      } else {
        sendError(
          res,
          'User creation failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }
);

/**
 * Delete a user (admin only)
 * DELETE /api/auth/delete-user/:userId
 */
router.delete('/delete-user/:userId',
  (req, res, next) => getAuthMiddleware().authenticate(req, res, next),
  (req, res, next) => getAuthMiddleware().requireAdmin(req, res, next),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        sendValidationError(res, 'User ID is required');
        return;
      }

      const success = await getSupabaseService().deleteUser(userId);

      if (!success) {
        sendError(
          res,
          'Failed to delete user',
          'User deletion failed. User might not exist.',
          HTTP_STATUS.BAD_REQUEST
        );
        return;
      }

      sendSuccess(res, {
        message: 'User deleted successfully'
      });
    } catch (error) {
      sendError(
        res,
        'User deletion failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
);

/**
 * Health check for auth service
 * GET /api/auth/health
 */
router.get('/health', (req, res) => {
  sendSuccess(res, {
    service: 'Authentication Service',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

export { router as authRouter }; 