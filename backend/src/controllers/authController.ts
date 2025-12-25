import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { User } from '@/types';

const generateTokens = (user: Partial<User>) => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
  const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  
  if (!jwtSecret || !jwtRefreshSecret) {
    throw new Error('JWT secrets are not configured');
  }

  const accessTokenOptions = { 
    expiresIn: jwtExpiresIn
  } as SignOptions;
  
  const refreshTokenOptions = { 
    expiresIn: jwtRefreshExpiresIn
  } as SignOptions;

  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      department: user.department,
    },
    jwtSecret,
    accessTokenOptions
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    jwtRefreshSecret,
    refreshTokenOptions
  );

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { email, password, firstName, lastName, role, department } = req.body;

  try {
    const db = getDatabase();

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new CustomError('User already exists with this email', 409);
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate user ID
    const userId = uuidv4();

    // Default permissions based on role
    const rolePermissions: { [key: string]: string[] } = {
      admin: ['*'],
      doctor: ['read_patients', 'create_patients', 'update_patients', 'read_medical_records', 'create_medical_records', 'update_medical_records', 'read_appointments', 'create_appointments', 'update_appointments'],
      nurse: ['read_patients', 'update_patients', 'read_medical_records', 'create_medical_records', 'read_appointments'],
      pharmacist: ['read_patients', 'read_prescriptions', 'update_prescriptions', 'manage_inventory'],
      lab_tech: ['read_patients', 'read_lab_orders', 'create_lab_results', 'update_lab_results'],
      radiologist: ['read_patients', 'read_imaging_orders', 'create_imaging_results', 'update_imaging_results'],
      hr: ['read_employees', 'create_employees', 'update_employees', 'manage_payroll'],
      finance: ['read_billing', 'create_billing', 'update_billing', 'manage_payments'],
    };

    const permissions = rolePermissions[role] || [];

    // Insert user into database
    const result = await db.query(
      `INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, email, first_name, last_name, role, department, permissions, is_active, created_at`,
      [userId, email, hashedPassword, firstName, lastName, role, department, JSON.stringify(permissions), true]
    );

    const user = result.rows[0];

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissions,
      department: user.department,
    });

    // Cache user data
    await setCache(`user:${user.id}`, {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissions,
      department: user.department,
    }, 3600); // 1 hour

    // Store refresh token
    await setCache(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 3600); // 7 days

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          department: user.department,
          permissions: permissions,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    throw error;
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { email, password } = req.body;

  try {
    const db = getDatabase();

    // Get user from database
    const result = await db.query(
      `SELECT id, email, password, first_name, last_name, role, department, permissions, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new CustomError('Invalid credentials', 401);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new CustomError('Account is deactivated', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new CustomError('Invalid credentials', 401);
    }

    // Generate tokens
    const permissions = JSON.parse(user.permissions || '[]');
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissions,
      department: user.department,
    });

    // Cache user data
    await setCache(`user:${user.id}`, {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissions,
      department: user.department,
    }, 3600); // 1 hour

    // Store refresh token
    await setCache(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 3600); // 7 days

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info(`User logged in successfully: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          department: user.department,
          permissions: permissions,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    throw error;
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new CustomError('Refresh token is required', 400);
  }

  try {
    // Verify refresh token
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtRefreshSecret) {
      throw new CustomError('JWT refresh secret not configured', 500);
    }
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as any;
    
    // Check if refresh token exists in cache
    const storedToken = await getCache(`refresh_token:${decoded.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new CustomError('Invalid refresh token', 401);
    }

    // Get user data
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, email, role, department, permissions, is_active
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      throw new CustomError('User not found or inactive', 401);
    }

    const user = result.rows[0];
    const permissions = JSON.parse(user.permissions || '[]');

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissions,
      department: user.department,
    });

    // Update refresh token in cache
    await setCache(`refresh_token:${user.id}`, newRefreshToken, 7 * 24 * 3600); // 7 days

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    throw error;
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);

    if (userId) {
      // Remove refresh token from cache
      await deleteCache(`refresh_token:${userId}`);
      
      // Remove user from cache
      await deleteCache(`user:${userId}`);
    }

    if (token) {
      // Add token to blacklist
      const decoded = jwt.decode(token) as any;
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await setCache(`blacklist:${token}`, 'true', expiresIn);
      }
    }

    logger.info(`User logged out: ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    throw error;
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const db = getDatabase();

    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, department, permissions, is_active, created_at, last_login
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new CustomError('User not found', 404);
    }

    const user = result.rows[0];
    const permissions = JSON.parse(user.permissions || '[]');

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          department: user.department,
          permissions: permissions,
          isActive: user.is_active,
          createdAt: user.created_at,
          lastLogin: user.last_login,
        },
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    throw error;
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, department } = req.body;
    const db = getDatabase();

    const result = await db.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, department = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, first_name, last_name, role, department, permissions`,
      [firstName, lastName, department, userId]
    );

    if (result.rows.length === 0) {
      throw new CustomError('User not found', 404);
    }

    const user = result.rows[0];
    const permissions = JSON.parse(user.permissions || '[]');

    // Update cache
    await setCache(`user:${user.id}`, {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissions,
      department: user.department,
    }, 3600);

    logger.info(`Profile updated for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          department: user.department,
          permissions: permissions,
        },
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    throw error;
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    const db = getDatabase();

    // Get current password
    const result = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new CustomError('User not found', 404);
    }

    const user = result.rows[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new CustomError('Current password is incorrect', 400);
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedNewPassword, userId]
    );

    logger.info(`Password changed for user: ${req.user?.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    throw error;
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  try {
    const { email } = req.body;
    const db = getDatabase();

    // Check if user exists
    const result = await db.query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
      return;
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token
    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, resetTokenExpiry, user.id]
    );

    // TODO: Send email with reset link
    // await sendPasswordResetEmail(user.email, resetToken);

    logger.info(`Password reset requested for: ${email}`);

    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    throw error;
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  try {
    const { token, password } = req.body;
    const db = getDatabase();

    // Find user with valid reset token
    const result = await db.query(
      `SELECT id, email FROM users 
       WHERE reset_token = $1 AND reset_token_expiry > NOW() AND is_active = true`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new CustomError('Invalid or expired reset token', 400);
    }

    const user = result.rows[0];

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    await db.query(
      `UPDATE users 
       SET password = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    logger.info(`Password reset completed for: ${user.email}`);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    throw error;
  }
};

export const verifyToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user,
    },
  });
};