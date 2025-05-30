import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export class SupabaseService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Verify a JWT token and return user information
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase.auth.getUser(token);
      
      if (error || !data.user) {
        return null;
      }

      return {
        id: data.user.id,
        email: data.user.email || '',
        created_at: data.user.created_at,
        updated_at: data.user.updated_at || data.user.created_at
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase.auth.admin.getUserById(userId);
      
      if (error || !data.user) {
        return null;
      }

      return {
        id: data.user.id,
        email: data.user.email || '',
        created_at: data.user.created_at,
        updated_at: data.user.updated_at || data.user.created_at
      };
    } catch (error) {
      console.error('Failed to get user by ID:', error);
      return null;
    }
  }

  /**
   * Create a new user (admin function)
   */
  async createUser(email: string, password: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (error || !data.user) {
        throw new Error(error?.message || 'Failed to create user');
      }

      return {
        id: data.user.id,
        email: data.user.email || '',
        created_at: data.user.created_at,
        updated_at: data.user.updated_at || data.user.created_at
      };
    } catch (error) {
      console.error('Failed to create user:', error);
      return null;
    }
  }

  /**
   * Delete a user (admin function)
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.auth.admin.deleteUser(userId);
      return !error;
    } catch (error) {
      console.error('Failed to delete user:', error);
      return false;
    }
  }
} 