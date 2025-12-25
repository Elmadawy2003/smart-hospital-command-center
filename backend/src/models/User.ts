import { query, queryOne, queryMany, transaction, buildSelectQuery, buildInsertQuery, buildUpdateQuery, buildDeleteQuery } from '@/utils/database';
import { USER_ROLES, EMPLOYEE_STATUS } from '@/utils/constants';
import { generateEmployeeId, hashString } from '@/utils/helpers';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  employee_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  department_id?: string;
  status: string;
  last_login?: Date;
  failed_login_attempts: number;
  locked_until?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  email_verified: boolean;
  email_verification_token?: string;
  two_factor_enabled: boolean;
  two_factor_secret?: string;
  profile_image?: string;
  date_of_birth?: Date;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  hire_date?: Date;
  salary?: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  department_id?: string;
  date_of_birth?: Date;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  hire_date?: Date;
  salary?: number;
  created_by?: string;
}

export interface UpdateUserData {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: string;
  department_id?: string;
  status?: string;
  date_of_birth?: Date;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  hire_date?: Date;
  salary?: number;
  updated_by?: string;
}

export interface UserFilters {
  role?: string;
  department_id?: string;
  status?: string;
  search?: string;
  hire_date_from?: Date;
  hire_date_to?: Date;
}

export class UserModel {
  private static tableName = 'users';

  /**
   * Create a new user
   */
  static async create(userData: CreateUserData): Promise<User> {
    const employee_id = generateEmployeeId();
    const password_hash = await bcrypt.hash(userData.password, 12);
    
    const data = {
      employee_id,
      email: userData.email.toLowerCase(),
      password_hash,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone: userData.phone,
      role: userData.role,
      department_id: userData.department_id,
      status: EMPLOYEE_STATUS.ACTIVE,
      failed_login_attempts: 0,
      email_verified: false,
      two_factor_enabled: false,
      date_of_birth: userData.date_of_birth,
      gender: userData.gender,
      address: userData.address,
      emergency_contact_name: userData.emergency_contact_name,
      emergency_contact_phone: userData.emergency_contact_phone,
      hire_date: userData.hire_date || new Date(),
      salary: userData.salary,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: userData.created_by,
    };

    const { query: insertQuery, values } = buildInsertQuery(this.tableName, data);
    const result = await queryOne<User>(insertQuery, values);
    
    if (!result) {
      throw new Error('Failed to create user');
    }

    return result;
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { id }
    );
    
    return await queryOne<User>(selectQuery, values);
  }

  /**
   * Find user by employee ID
   */
  static async findByEmployeeId(employee_id: string): Promise<User | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { employee_id }
    );
    
    return await queryOne<User>(selectQuery, values);
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { email: email.toLowerCase() }
    );
    
    return await queryOne<User>(selectQuery, values);
  }

  /**
   * Find users with filters and pagination
   */
  static async findMany(
    filters: UserFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ users: User[]; total: number }> {
    const whereConditions: Record<string, any> = {};

    if (filters.role) {
      whereConditions.role = filters.role;
    }

    if (filters.department_id) {
      whereConditions.department_id = filters.department_id;
    }

    if (filters.status) {
      whereConditions.status = filters.status;
    }

    if (filters.search) {
      // This will need to be handled differently in the actual query
      // For now, we'll use a simple ILIKE on first_name
      whereConditions.first_name = `%${filters.search}%`;
    }

    if (filters.hire_date_from) {
      whereConditions.hire_date = {
        operator: '>=',
        value: filters.hire_date_from,
      };
    }

    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      whereConditions,
      sortBy,
      sortOrder,
      page,
      limit
    );

    const users = await queryMany<User>(selectQuery, values);

    // Get total count
    const { query: countQuery, values: countValues } = buildSelectQuery(
      this.tableName,
      ['COUNT(*) as total'],
      whereConditions
    );
    
    const countResult = await queryOne<{ total: string }>(countQuery, countValues);
    const total = parseInt(countResult?.total || '0', 10);

    return { users, total };
  }

  /**
   * Update user
   */
  static async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    const data = {
      ...updateData,
      updated_at: new Date(),
    };

    if (updateData.email) {
      data.email = updateData.email.toLowerCase();
    }

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    return await queryOne<User>(updateQuery, values);
  }

  /**
   * Update password
   */
  static async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const password_hash = await bcrypt.hash(newPassword, 12);
    
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        password_hash,
        password_reset_token: null,
        password_reset_expires: null,
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Verify password
   */
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update last login
   */
  static async updateLastLogin(id: string): Promise<void> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        last_login: new Date(),
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: new Date(),
      },
      { id }
    );

    await query(updateQuery, values);
  }

  /**
   * Increment failed login attempts
   */
  static async incrementFailedLoginAttempts(id: string): Promise<void> {
    const updateQuery = `
      UPDATE ${this.tableName} 
      SET 
        failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE 
          WHEN failed_login_attempts + 1 >= 5 
          THEN NOW() + INTERVAL '30 minutes'
          ELSE locked_until
        END,
        updated_at = NOW()
      WHERE id = $1
    `;

    await query(updateQuery, [id]);
  }

  /**
   * Set password reset token
   */
  static async setPasswordResetToken(
    email: string,
    token: string,
    expiresAt: Date
  ): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        password_reset_token: hashString(token),
        password_reset_expires: expiresAt,
        updated_at: new Date(),
      },
      { email: email.toLowerCase() }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Verify password reset token
   */
  static async verifyPasswordResetToken(token: string): Promise<User | null> {
    const hashedToken = hashString(token);
    
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE password_reset_token = $1 
      AND password_reset_expires > NOW()
    `;

    return await queryOne<User>(selectQuery, [hashedToken]);
  }

  /**
   * Set email verification token
   */
  static async setEmailVerificationToken(id: string, token: string): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        email_verification_token: hashString(token),
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Verify email
   */
  static async verifyEmail(token: string): Promise<User | null> {
    const hashedToken = hashString(token);
    
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        email_verified: true,
        email_verification_token: null,
        updated_at: new Date(),
      },
      { email_verification_token: hashedToken }
    );

    return await queryOne<User>(updateQuery, values);
  }

  /**
   * Enable/disable two-factor authentication
   */
  static async updateTwoFactor(
    id: string,
    enabled: boolean,
    secret?: string
  ): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        two_factor_enabled: enabled,
        two_factor_secret: enabled ? secret : null,
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Delete user (soft delete by setting status to inactive)
   */
  static async delete(id: string): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        status: EMPLOYEE_STATUS.TERMINATED,
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Hard delete user (permanent deletion)
   */
  static async hardDelete(id: string): Promise<boolean> {
    const { query: deleteQuery, values } = buildDeleteQuery(
      this.tableName,
      { id }
    );

    const result = await query(deleteQuery, values);
    return result.rowCount > 0;
  }

  /**
   * Get users by role
   */
  static async findByRole(role: string): Promise<User[]> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { role, status: EMPLOYEE_STATUS.ACTIVE }
    );

    return await queryMany<User>(selectQuery, values);
  }

  /**
   * Get users by department
   */
  static async findByDepartment(department_id: string): Promise<User[]> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { department_id, status: EMPLOYEE_STATUS.ACTIVE }
    );

    return await queryMany<User>(selectQuery, values);
  }

  /**
   * Check if email exists
   */
  static async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const conditions: Record<string, any> = {
      email: email.toLowerCase(),
    };

    if (excludeId) {
      conditions.id = { operator: '!=', value: excludeId };
    }

    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['id'],
      conditions
    );

    const result = await queryOne(selectQuery, values);
    return !!result;
  }

  /**
   * Get user statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
    recentRegistrations: number;
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = '${EMPLOYEE_STATUS.ACTIVE}' THEN 1 END) as active,
        COUNT(CASE WHEN status = '${EMPLOYEE_STATUS.INACTIVE}' THEN 1 END) as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_registrations
      FROM ${this.tableName}
    `;

    const roleStatsQuery = `
      SELECT role, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = '${EMPLOYEE_STATUS.ACTIVE}'
      GROUP BY role
    `;

    const [stats, roleStats] = await Promise.all([
      queryOne<{
        total: string;
        active: string;
        inactive: string;
        recent_registrations: string;
      }>(statsQuery),
      queryMany<{ role: string; count: string }>(roleStatsQuery),
    ]);

    const byRole = roleStats.reduce((acc, item) => {
      acc[item.role] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      total: parseInt(stats?.total || '0', 10),
      active: parseInt(stats?.active || '0', 10),
      inactive: parseInt(stats?.inactive || '0', 10),
      byRole,
      recentRegistrations: parseInt(stats?.recent_registrations || '0', 10),
    };
  }
}