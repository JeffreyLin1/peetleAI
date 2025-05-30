import { Request, Response, NextFunction } from 'express';
import { SupabaseService, User } from '../services/supabase';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export class AuthMiddleware {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Middleware to authenticate requests using Supabase JWT tokens
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid Bearer token in the Authorization header'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!token) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Token is missing'
        });
        return;
      }

      // Verify token with Supabase
      const user = await this.supabaseService.verifyToken(token);

      if (!user) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'The provided token is invalid or expired'
        });
        return;
      }

      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        error: 'Authentication error',
        message: 'An error occurred during authentication'
      });
    }
  };

  /**
   * Optional middleware for routes that can work with or without authentication
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        if (token) {
          const user = await this.supabaseService.verifyToken(token);
          if (user) {
            req.user = user;
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('Optional authentication middleware error:', error);
      // Don't fail the request for optional auth
      next();
    }
  };

  /**
   * Middleware to check if user has admin privileges
   * This is a placeholder - you can extend this based on your user roles system
   */
  requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
      return;
    }

    // For now, we'll consider all authenticated users as having access
    // You can extend this to check for specific roles or permissions
    // For example, check if user.email ends with your domain or has admin role
    
    next();
  };
} 