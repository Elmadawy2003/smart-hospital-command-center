import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { AppError } from '@/middleware/errorHandler';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  private static readonly BLACKLIST_PREFIX = 'blacklist:';
  private static readonly REFRESH_TOKEN_PREFIX = 'refresh:';

  /**
   * Generate JWT tokens for user
   */
  static async generateTokens(user: User): Promise<TokenPair> {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET!,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    // Store refresh token in Redis
    await redis.setex(
      `${this.REFRESH_TOKEN_PREFIX}${user.id}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      refreshToken
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  static async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await redis.get(`${this.BLACKLIST_PREFIX}${token}`);
      if (isBlacklisted) {
        throw new AppError('Token has been revoked', 401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid token', 401);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Token expired', 401);
      }
      throw error;
    }
  }

  /**
   * Verify refresh token and generate new access token
   */
  static async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!
      ) as { userId: string };

      // Check if refresh token exists in Redis
      const storedToken = await redis.get(`${this.REFRESH_TOKEN_PREFIX}${decoded.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        throw new AppError('User not found or inactive', 401);
      }

      // Generate new access token
      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
      };

      return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid refresh token', 401);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Refresh token expired', 401);
      }
      throw error;
    }
  }

  /**
   * Blacklist access token (logout)
   */
  static async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const expiryTime = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiryTime > 0) {
          await redis.setex(`${this.BLACKLIST_PREFIX}${token}`, expiryTime, 'true');
        }
      }
    } catch (error) {
      // Token might be invalid, but we still want to attempt blacklisting
    }
  }

  /**
   * Revoke refresh token
   */
  static async revokeRefreshToken(userId: string): Promise<void> {
    await redis.del(`${this.REFRESH_TOKEN_PREFIX}${userId}`);
  }

  /**
   * Hash password
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken(): string {
    return jwt.sign(
      { type: 'password_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  }

  /**
   * Verify password reset token
   */
  static verifyPasswordResetToken(token: string): boolean {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      return decoded.type === 'password_reset';
    } catch {
      return false;
    }
  }

  /**
   * Get user permissions based on role
   */
  static getUserPermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: [
        'users:*',
        'patients:*',
        'appointments:*',
        'medical_records:*',
        'pharmacy:*',
        'hr:*',
        'finance:*',
        'dashboard:*',
        'reports:*',
      ],
      doctor: [
        'patients:read',
        'patients:update',
        'appointments:read',
        'appointments:update',
        'medical_records:*',
        'pharmacy:read',
        'dashboard:read',
      ],
      nurse: [
        'patients:read',
        'patients:update',
        'appointments:read',
        'appointments:update',
        'medical_records:read',
        'medical_records:create',
        'pharmacy:read',
        'dashboard:read',
      ],
      pharmacist: [
        'patients:read',
        'pharmacy:*',
        'dashboard:read',
      ],
      lab_tech: [
        'patients:read',
        'lab:*',
        'dashboard:read',
      ],
      radiologist: [
        'patients:read',
        'imaging:*',
        'dashboard:read',
      ],
      hr: [
        'hr:*',
        'dashboard:read',
        'reports:hr',
      ],
      finance: [
        'finance:*',
        'dashboard:read',
        'reports:finance',
      ],
      receptionist: [
        'patients:*',
        'appointments:*',
        'dashboard:read',
      ],
    };

    return rolePermissions[role] || [];
  }

  /**
   * Check if user has specific permission
   */
  static hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Check for wildcard permissions
    const wildcardPermission = requiredPermission.split(':')[0] + ':*';
    
    return userPermissions.includes(requiredPermission) ||
           userPermissions.includes(wildcardPermission) ||
           userPermissions.includes('*');
  }

  /**
   * Check if user has specific role
   */
  static hasRole(userRole: string, requiredRoles: string[]): boolean {
    return requiredRoles.includes(userRole) || userRole === 'admin';
  }
}