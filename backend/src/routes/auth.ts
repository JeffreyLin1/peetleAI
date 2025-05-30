import express from 'express';
import { SupabaseService } from '../services/supabase';
import { AuthMiddleware } from '../middleware/auth';

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

// GET /api/auth/me - Get current user information
router.get('/me', (req, res, next) => getAuthMiddleware().authenticate(req, res, next), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Authentication failed'
      });
    }

    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get user information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/auth/verify - Verify token validity
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Token is required',
        message: 'Please provide a valid token'
      });
    }

    const user = await getSupabaseService().verifyToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Token verification failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/auth/create-user - Create a new user (admin only)
router.post('/create-user', 
  (req, res, next) => getAuthMiddleware().authenticate(req, res, next),
  (req, res, next) => getAuthMiddleware().requireAdmin(req, res, next),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
          message: 'Please provide both email and password'
        });
      }

      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({
          error: 'Invalid input',
          message: 'Email and password must be strings'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password too short',
          message: 'Password must be at least 6 characters long'
        });
      }

      const user = await getSupabaseService().createUser(email, password);

      if (!user) {
        return res.status(400).json({
          error: 'Failed to create user',
          message: 'User creation failed. Email might already be in use.'
        });
      }

      res.status(201).json({
        success: true,
        data: {
          user,
          message: 'User created successfully'
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'User creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// DELETE /api/auth/delete-user/:userId - Delete a user (admin only)
router.delete('/delete-user/:userId',
  (req, res, next) => getAuthMiddleware().authenticate(req, res, next),
  (req, res, next) => getAuthMiddleware().requireAdmin(req, res, next),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          message: 'Please provide a valid user ID'
        });
      }

      const success = await getSupabaseService().deleteUser(userId);

      if (!success) {
        return res.status(400).json({
          error: 'Failed to delete user',
          message: 'User deletion failed. User might not exist.'
        });
      }

      res.json({
        success: true,
        data: {
          message: 'User deleted successfully'
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'User deletion failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/auth/health - Health check for auth service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Authentication Service',
      status: 'OK',
      timestamp: new Date().toISOString()
    }
  });
});

export { router as authRouter }; 