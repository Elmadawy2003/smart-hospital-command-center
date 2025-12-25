import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { APIResponse, User, UserProfile } from '@/types';

export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string;
    const department = req.query.department as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const offset = (page - 1) * limit;

    const cacheKey = `users_${page}_${limit}_${role}_${department}_${status}_${search}`;

    // Try to get from cache first
    const cachedUsers = await getCache(cacheKey);
    if (cachedUsers) {
      const response: APIResponse<any> = {
        success: true,
        data: cachedUsers,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();

    // Build WHERE clause
    let whereConditions = ['1=1'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      queryParams.push(role);
      paramIndex++;
    }

    if (department) {
      whereConditions.push(`u.department_id = $${paramIndex}`);
      queryParams.push(department);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`u.is_active = $${paramIndex}`);
      queryParams.push(status === 'active');
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get users with pagination
    const usersQuery = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.phone,
        u.is_active,
        u.last_login,
        u.created_at,
        d.name as department_name,
        up.avatar_url,
        up.specialization,
        up.license_number
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE ${whereClause}
    `;

    const [usersResult, countResult] = await Promise.all([
      db.query(usersQuery, queryParams),
      db.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);

    const users = usersResult.rows.map(user => ({
      ...user,
      password: undefined // Never return password
    }));

    const total = parseInt(countResult.rows[0].total);

    const result = {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Cache for 5 minutes
    await setCache(cacheKey, result, 300);

    const response: APIResponse<any> = {
      success: true,
      data: result,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching users:', error);
    throw error;
  }
};

export const getUserById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const { userId } = req.params;

    const cacheKey = `user_${userId}`;

    // Try to get from cache first
    const cachedUser = await getCache(cacheKey);
    if (cachedUser) {
      const response: APIResponse<User> = {
        success: true,
        data: cachedUser,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();

    const userQuery = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.phone,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        d.name as department_name,
        d.id as department_id,
        up.avatar_url,
        up.specialization,
        up.license_number,
        up.bio,
        up.education,
        up.experience_years,
        up.languages,
        up.certifications
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id = $1
    `;

    const result = await db.query(userQuery, [userId]);

    if (result.rows.length === 0) {
      throw new CustomError('User not found', 404);
    }

    const user = result.rows[0];
    delete user.password; // Never return password

    // Cache for 10 minutes
    await setCache(cacheKey, user, 600);

    const response: APIResponse<User> = {
      success: true,
      data: user,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching user by ID:', error);
    throw error;
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const {
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
      departmentId,
      specialization,
      licenseNumber
    } = req.body;

    const db = getDatabase();

    // Check if user already exists
    const existingUserQuery = `
      SELECT id FROM users WHERE email = $1
    `;

    const existingUser = await db.query(existingUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      throw new CustomError('User with this email already exists', 409);
    }

    // Check if department exists
    if (departmentId) {
      const departmentQuery = `
        SELECT id FROM departments WHERE id = $1
      `;

      const departmentResult = await db.query(departmentQuery, [departmentId]);

      if (departmentResult.rows.length === 0) {
        throw new CustomError('Department not found', 404);
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userId = uuidv4();

    // Begin transaction
    await db.query('BEGIN');

    try {
      // Create user
      const createUserQuery = `
        INSERT INTO users (
          id, email, password, first_name, last_name, role, phone, department_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id, email, first_name, last_name, role, phone, is_active, created_at
      `;

      const userResult = await db.query(createUserQuery, [
        userId,
        email,
        hashedPassword,
        firstName,
        lastName,
        role,
        phone,
        departmentId
      ]);

      // Create user profile if additional info provided
      if (specialization || licenseNumber) {
        const createProfileQuery = `
          INSERT INTO user_profiles (
            user_id, specialization, license_number, created_at
          ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `;

        await db.query(createProfileQuery, [
          userId,
          specialization,
          licenseNumber
        ]);
      }

      await db.query('COMMIT');

      const newUser = userResult.rows[0];

      // Clear users cache
      await deleteCache('users_*');

      const response: APIResponse<User> = {
        success: true,
        data: newUser,
        message: 'User created successfully',
        timestamp: new Date()
      };

      res.status(201).json(response);
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const { userId } = req.params;
    const {
      email,
      firstName,
      lastName,
      role,
      phone,
      departmentId,
      isActive
    } = req.body;

    const db = getDatabase();

    // Check if user exists
    const userCheckQuery = `
      SELECT id FROM users WHERE id = $1
    `;

    const userCheckResult = await db.query(userCheckQuery, [userId]);

    if (userCheckResult.rows.length === 0) {
      throw new CustomError('User not found', 404);
    }

    // Check if email is already taken by another user
    if (email) {
      const emailCheckQuery = `
        SELECT id FROM users WHERE email = $1 AND id != $2
      `;

      const emailCheckResult = await db.query(emailCheckQuery, [email, userId]);

      if (emailCheckResult.rows.length > 0) {
        throw new CustomError('Email is already taken by another user', 409);
      }
    }

    // Check if department exists
    if (departmentId) {
      const departmentQuery = `
        SELECT id FROM departments WHERE id = $1
      `;

      const departmentResult = await db.query(departmentQuery, [departmentId]);

      if (departmentResult.rows.length === 0) {
        throw new CustomError('Department not found', 404);
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex}`);
      updateValues.push(email);
      paramIndex++;
    }

    if (firstName !== undefined) {
      updateFields.push(`first_name = $${paramIndex}`);
      updateValues.push(firstName);
      paramIndex++;
    }

    if (lastName !== undefined) {
      updateFields.push(`last_name = $${paramIndex}`);
      updateValues.push(lastName);
      paramIndex++;
    }

    if (role !== undefined) {
      updateFields.push(`role = $${paramIndex}`);
      updateValues.push(role);
      paramIndex++;
    }

    if (phone !== undefined) {
      updateFields.push(`phone = $${paramIndex}`);
      updateValues.push(phone);
      paramIndex++;
    }

    if (departmentId !== undefined) {
      updateFields.push(`department_id = $${paramIndex}`);
      updateValues.push(departmentId);
      paramIndex++;
    }

    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(isActive);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new CustomError('No fields to update', 400);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, first_name, last_name, role, phone, is_active, updated_at
    `;

    const result = await db.query(updateQuery, updateValues);

    // Clear cache
    await deleteCache(`user_${userId}`);
    await deleteCache('users_*');

    const response: APIResponse<User> = {
      success: true,
      data: result.rows[0],
      message: 'User updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const { userId } = req.params;
    const currentUserId = req.user?.id;

    if (userId === currentUserId) {
      throw new CustomError('Cannot delete your own account', 400);
    }

    const db = getDatabase();

    // Check if user exists
    const userCheckQuery = `
      SELECT id FROM users WHERE id = $1
    `;

    const userCheckResult = await db.query(userCheckQuery, [userId]);

    if (userCheckResult.rows.length === 0) {
      throw new CustomError('User not found', 404);
    }

    // Soft delete - deactivate user instead of hard delete
    const deactivateQuery = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await db.query(deactivateQuery, [userId]);

    // Clear cache
    await deleteCache(`user_${userId}`);
    await deleteCache('users_*');

    const response: APIResponse<null> = {
      success: true,
      data: null,
      message: 'User deactivated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error deleting user:', error);
    throw error;
  }
};

export const updateUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const { userId } = req.params;
    const {
      avatarUrl,
      specialization,
      licenseNumber,
      bio,
      education,
      experienceYears,
      languages,
      certifications
    } = req.body;

    const db = getDatabase();

    // Check if user exists
    const userCheckQuery = `
      SELECT id FROM users WHERE id = $1
    `;

    const userCheckResult = await db.query(userCheckQuery, [userId]);

    if (userCheckResult.rows.length === 0) {
      throw new CustomError('User not found', 404);
    }

    // Check if profile exists
    const profileCheckQuery = `
      SELECT user_id FROM user_profiles WHERE user_id = $1
    `;

    const profileCheckResult = await db.query(profileCheckQuery, [userId]);

    let query;
    let values;

    if (profileCheckResult.rows.length === 0) {
      // Create new profile
      query = `
        INSERT INTO user_profiles (
          user_id, avatar_url, specialization, license_number, bio, 
          education, experience_years, languages, certifications, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      values = [
        userId,
        avatarUrl,
        specialization,
        licenseNumber,
        bio,
        education,
        experienceYears,
        JSON.stringify(languages),
        JSON.stringify(certifications)
      ];
    } else {
      // Update existing profile
      query = `
        UPDATE user_profiles 
        SET 
          avatar_url = $2,
          specialization = $3,
          license_number = $4,
          bio = $5,
          education = $6,
          experience_years = $7,
          languages = $8,
          certifications = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;

      values = [
        userId,
        avatarUrl,
        specialization,
        licenseNumber,
        bio,
        education,
        experienceYears,
        JSON.stringify(languages),
        JSON.stringify(certifications)
      ];
    }

    const result = await db.query(query, values);

    // Clear cache
    await deleteCache(`user_${userId}`);

    const response: APIResponse<UserProfile> = {
      success: true,
      data: result.rows[0],
      message: 'User profile updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating user profile:', error);
    throw error;
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;
    const requestingUserId = req.user?.id;

    // Users can only change their own password unless they're admin
    if (userId !== requestingUserId && req.user?.role !== 'admin') {
      throw new CustomError('Unauthorized to change this user\'s password', 403);
    }

    const db = getDatabase();

    // Get current password hash
    const userQuery = `
      SELECT password FROM users WHERE id = $1
    `;

    const userResult = await db.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      throw new CustomError('User not found', 404);
    }

    // Verify current password (only if user is changing their own password)
    if (userId === requestingUserId) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);

      if (!isCurrentPasswordValid) {
        throw new CustomError('Current password is incorrect', 400);
      }
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const updateQuery = `
      UPDATE users 
      SET password = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    await db.query(updateQuery, [hashedNewPassword, userId]);

    const response: APIResponse<null> = {
      success: true,
      data: null,
      message: 'Password changed successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error changing password:', error);
    throw error;
  }
};

export const getUserStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const statsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'doctor' THEN 1 END) as doctors,
        COUNT(CASE WHEN role = 'nurse' THEN 1 END) as nurses,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'receptionist' THEN 1 END) as receptionists,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
        COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_logins
      FROM users
    `;

    const result = await db.query(statsQuery);

    const response: APIResponse = {
      success: true,
      data: result.rows[0],
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    throw error;
  }
};