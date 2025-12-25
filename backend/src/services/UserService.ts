import { UserModel, User, CreateUserData, UpdateUserData, UserFilters } from '../models/User';
import { AppError } from '../utils/AppError';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class UserService {
  /**
   * Create a new user
   */
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      // Check if user with email already exists
      const existingUser = await UserModel.findByEmail(userData.email);
      if (existingUser) {
        throw new AppError('User with this email already exists', 400);
      }

      // Validate role
      const validRoles = ['admin', 'doctor', 'nurse', 'receptionist'];
      if (!validRoles.includes(userData.role)) {
        throw new AppError('Invalid role specified', 400);
      }

      return await UserModel.create(userData);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create user', 500);
    }
  }

  /**
   * Authenticate user
   */
  async authenticateUser(email: string, password: string): Promise<{ user: User; token: string }> {
    try {
      const user = await UserModel.findByEmail(email);
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
      }

      if (user.status !== 'active') {
        throw new AppError('User account is inactive', 401);
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '24h' }
      );

      return { user, token };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Authentication failed', 500);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      return await UserModel.findById(id);
    } catch (error) {
      throw new AppError('Failed to get user', 500);
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, updateData: UpdateUserData): Promise<User> {
    try {
      const user = await UserModel.findById(id);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Hash password if provided
      if (updateData.password) {
        updateData.password_hash = await bcrypt.hash(updateData.password, 12);
        delete updateData.password;
      }

      return await UserModel.update(id, updateData);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update user', 500);
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      const user = await UserModel.findById(id);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return await UserModel.delete(id);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete user', 500);
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<User[]> {
    try {
      return await UserModel.findByRole(role);
    } catch (error) {
      throw new AppError('Failed to get users by role', 500);
    }
  }

  /**
   * Validate token
   */
  async validateToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
      return await UserModel.findById(decoded.userId);
    } catch (error) {
      return null;
    }
  }
}