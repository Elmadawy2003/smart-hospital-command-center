import { query, queryOne, queryMany, buildSelectQuery, buildInsertQuery, buildUpdateQuery, buildDeleteQuery } from '@/utils/database';
import { EMPLOYEE_STATUS, GENDER, MARITAL_STATUS, LEAVE_TYPES, USER_ROLES, DEPARTMENTS } from '@/utils/constants';
import { generateEmployeeId, calculateAge } from '@/utils/helpers';
import { hashPassword } from '@/services/authService';

export interface Employee {
  id: string;
  employee_id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: Date;
  age: number;
  gender: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  marital_status?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  department: string;
  position: string;
  role: string;
  hire_date: Date;
  employment_type: string; // full-time, part-time, contract, intern
  salary: number;
  hourly_rate?: number;
  benefits?: string[];
  skills?: string[];
  certifications?: string[];
  education?: {
    degree: string;
    institution: string;
    year: number;
    field_of_study: string;
  }[];
  experience_years: number;
  supervisor_id?: string;
  shift_schedule?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  status: string;
  termination_date?: Date;
  termination_reason?: string;
  performance_rating?: number;
  last_performance_review?: Date;
  next_performance_review?: Date;
  profile_image?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreateEmployeeData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: Date;
  gender: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  marital_status?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  department: string;
  position: string;
  role: string;
  hire_date: Date;
  employment_type: string;
  salary: number;
  hourly_rate?: number;
  benefits?: string[];
  skills?: string[];
  certifications?: string[];
  education?: {
    degree: string;
    institution: string;
    year: number;
    field_of_study: string;
  }[];
  experience_years: number;
  supervisor_id?: string;
  shift_schedule?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  performance_rating?: number;
  notes?: string;
  created_by?: string;
}

export interface UpdateEmployeeData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: Date;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  marital_status?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  department?: string;
  position?: string;
  role?: string;
  employment_type?: string;
  salary?: number;
  hourly_rate?: number;
  benefits?: string[];
  skills?: string[];
  certifications?: string[];
  education?: {
    degree: string;
    institution: string;
    year: number;
    field_of_study: string;
  }[];
  experience_years?: number;
  supervisor_id?: string;
  shift_schedule?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  status?: string;
  termination_date?: Date;
  termination_reason?: string;
  performance_rating?: number;
  last_performance_review?: Date;
  next_performance_review?: Date;
  notes?: string;
  updated_by?: string;
}

export interface EmployeeFilters {
  department?: string;
  position?: string;
  role?: string;
  status?: string;
  employment_type?: string;
  supervisor_id?: string;
  hire_date_from?: Date;
  hire_date_to?: Date;
  salary_min?: number;
  salary_max?: number;
  search?: string;
}

export class EmployeeModel {
  private static tableName = 'employees';

  /**
   * Create a new employee
   */
  static async create(employeeData: CreateEmployeeData): Promise<Employee> {
    const employeeId = generateEmployeeId();
    const age = calculateAge(employeeData.date_of_birth);
    
    const data = {
      employee_id: employeeId,
      first_name: employeeData.first_name,
      last_name: employeeData.last_name,
      email: employeeData.email.toLowerCase(),
      phone: employeeData.phone,
      date_of_birth: employeeData.date_of_birth,
      age,
      gender: employeeData.gender,
      address: employeeData.address,
      city: employeeData.city,
      state: employeeData.state,
      zip_code: employeeData.zip_code,
      country: employeeData.country,
      marital_status: employeeData.marital_status,
      emergency_contact_name: employeeData.emergency_contact_name,
      emergency_contact_phone: employeeData.emergency_contact_phone,
      emergency_contact_relationship: employeeData.emergency_contact_relationship,
      department: employeeData.department,
      position: employeeData.position,
      role: employeeData.role,
      hire_date: employeeData.hire_date,
      employment_type: employeeData.employment_type,
      salary: employeeData.salary,
      hourly_rate: employeeData.hourly_rate,
      benefits: JSON.stringify(employeeData.benefits || []),
      skills: JSON.stringify(employeeData.skills || []),
      certifications: JSON.stringify(employeeData.certifications || []),
      education: JSON.stringify(employeeData.education || []),
      experience_years: employeeData.experience_years,
      supervisor_id: employeeData.supervisor_id,
      shift_schedule: JSON.stringify(employeeData.shift_schedule || {}),
      status: EMPLOYEE_STATUS.ACTIVE,
      performance_rating: employeeData.performance_rating,
      next_performance_review: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      notes: employeeData.notes,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: employeeData.created_by,
    };

    const { query: insertQuery, values } = buildInsertQuery(this.tableName, data);
    const result = await queryOne<Employee>(insertQuery, values);
    
    if (!result) {
      throw new Error('Failed to create employee');
    }

    return this.parseJsonFields(result);
  }

  /**
   * Find employee by ID
   */
  static async findById(id: string): Promise<Employee | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { id }
    );
    
    const result = await queryOne<Employee>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find employee by employee ID
   */
  static async findByEmployeeId(employeeId: string): Promise<Employee | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { employee_id: employeeId }
    );
    
    const result = await queryOne<Employee>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find employee by email
   */
  static async findByEmail(email: string): Promise<Employee | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { email: email.toLowerCase() }
    );
    
    const result = await queryOne<Employee>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find employees with filters and pagination
   */
  static async findMany(
    filters: EmployeeFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ employees: Employee[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.department) {
      whereClause += ` AND department = $${paramIndex++}`;
      values.push(filters.department);
    }

    if (filters.position) {
      whereClause += ` AND position ILIKE $${paramIndex++}`;
      values.push(`%${filters.position}%`);
    }

    if (filters.role) {
      whereClause += ` AND role = $${paramIndex++}`;
      values.push(filters.role);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.employment_type) {
      whereClause += ` AND employment_type = $${paramIndex++}`;
      values.push(filters.employment_type);
    }

    if (filters.supervisor_id) {
      whereClause += ` AND supervisor_id = $${paramIndex++}`;
      values.push(filters.supervisor_id);
    }

    if (filters.hire_date_from) {
      whereClause += ` AND hire_date >= $${paramIndex++}`;
      values.push(filters.hire_date_from);
    }

    if (filters.hire_date_to) {
      whereClause += ` AND hire_date <= $${paramIndex++}`;
      values.push(filters.hire_date_to);
    }

    if (filters.salary_min !== undefined) {
      whereClause += ` AND salary >= $${paramIndex++}`;
      values.push(filters.salary_min);
    }

    if (filters.salary_max !== undefined) {
      whereClause += ` AND salary <= $${paramIndex++}`;
      values.push(filters.salary_max);
    }

    if (filters.search) {
      whereClause += ` AND (
        first_name ILIKE $${paramIndex} OR 
        last_name ILIKE $${paramIndex} OR 
        employee_id ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex} OR
        position ILIKE $${paramIndex}
      )`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const orderBy = `ORDER BY ${sortBy} ${sortOrder}`;
    const limitClause = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const selectQuery = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ${orderBy}
      ${limitClause}
    `;

    const employees = await queryMany<Employee>(selectQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.tableName}
      ${whereClause}
    `;
    
    const countResult = await queryOne<{ total: string }>(countQuery, values.slice(0, -2));
    const total = parseInt(countResult?.total || '0', 10);

    return {
      employees: employees.map(employee => this.parseJsonFields(employee)),
      total
    };
  }

  /**
   * Update employee
   */
  static async update(id: string, updateData: UpdateEmployeeData): Promise<Employee | null> {
    const data: Record<string, any> = {
      ...updateData,
      updated_at: new Date(),
    };

    if (updateData.email) {
      data.email = updateData.email.toLowerCase();
    }

    if (updateData.date_of_birth) {
      data.age = calculateAge(updateData.date_of_birth);
    }

    // Handle JSON fields
    if (updateData.benefits) {
      data.benefits = JSON.stringify(updateData.benefits);
    }

    if (updateData.skills) {
      data.skills = JSON.stringify(updateData.skills);
    }

    if (updateData.certifications) {
      data.certifications = JSON.stringify(updateData.certifications);
    }

    if (updateData.education) {
      data.education = JSON.stringify(updateData.education);
    }

    if (updateData.shift_schedule) {
      data.shift_schedule = JSON.stringify(updateData.shift_schedule);
    }

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<Employee>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Terminate employee
   */
  static async terminate(
    id: string,
    terminationDate: Date,
    reason: string,
    terminatedBy: string
  ): Promise<Employee | null> {
    const data = {
      status: EMPLOYEE_STATUS.TERMINATED,
      termination_date: terminationDate,
      termination_reason: reason,
      updated_at: new Date(),
      updated_by: terminatedBy,
    };

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<Employee>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Update performance review
   */
  static async updatePerformanceReview(
    id: string,
    rating: number,
    reviewDate: Date,
    nextReviewDate: Date,
    reviewedBy: string
  ): Promise<Employee | null> {
    const data = {
      performance_rating: rating,
      last_performance_review: reviewDate,
      next_performance_review: nextReviewDate,
      updated_at: new Date(),
      updated_by: reviewedBy,
    };

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<Employee>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Get employees by department
   */
  static async findByDepartment(department: string): Promise<Employee[]> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { department, status: EMPLOYEE_STATUS.ACTIVE }
    );

    const employees = await queryMany<Employee>(selectQuery, values);
    return employees.map(employee => this.parseJsonFields(employee));
  }

  /**
   * Get employees by role
   */
  static async findByRole(role: string): Promise<Employee[]> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { role, status: EMPLOYEE_STATUS.ACTIVE }
    );

    const employees = await queryMany<Employee>(selectQuery, values);
    return employees.map(employee => this.parseJsonFields(employee));
  }

  /**
   * Get employees by supervisor
   */
  static async findBySupervisor(supervisorId: string): Promise<Employee[]> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { supervisor_id: supervisorId, status: EMPLOYEE_STATUS.ACTIVE }
    );

    const employees = await queryMany<Employee>(selectQuery, values);
    return employees.map(employee => this.parseJsonFields(employee));
  }

  /**
   * Get employees with upcoming performance reviews
   */
  static async getUpcomingPerformanceReviews(days: number = 30): Promise<Employee[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE next_performance_review <= CURRENT_DATE + INTERVAL '${days} days'
        AND status = '${EMPLOYEE_STATUS.ACTIVE}'
      ORDER BY next_performance_review ASC
    `;

    const employees = await queryMany<Employee>(selectQuery);
    return employees.map(employee => this.parseJsonFields(employee));
  }

  /**
   * Search employees
   */
  static async search(searchTerm: string, limit: number = 10): Promise<Employee[]> {
    const searchQuery = `
      SELECT * FROM ${this.tableName}
      WHERE (
        first_name ILIKE $1 OR 
        last_name ILIKE $1 OR 
        employee_id ILIKE $1 OR
        email ILIKE $1 OR
        position ILIKE $1 OR
        CONCAT(first_name, ' ', last_name) ILIKE $1
      )
      AND status = $2
      ORDER BY 
        CASE 
          WHEN employee_id ILIKE $1 THEN 1
          WHEN first_name ILIKE $1 THEN 2
          WHEN last_name ILIKE $1 THEN 3
          ELSE 4
        END,
        first_name, last_name
      LIMIT $3
    `;

    const employees = await queryMany<Employee>(searchQuery, [
      `%${searchTerm}%`,
      EMPLOYEE_STATUS.ACTIVE,
      limit
    ]);

    return employees.map(employee => this.parseJsonFields(employee));
  }

  /**
   * Check if employee ID exists
   */
  static async employeeIdExists(employeeId: string, excludeId?: string): Promise<boolean> {
    const conditions: Record<string, any> = { employee_id: employeeId };

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
   * Check if email exists
   */
  static async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const conditions: Record<string, any> = { email: email.toLowerCase() };

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
   * Get employee statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    terminated: number;
    byDepartment: Record<string, number>;
    byRole: Record<string, number>;
    byEmploymentType: Record<string, number>;
    averageSalary: number;
    recentHires: number;
    upcomingReviews: number;
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = '${EMPLOYEE_STATUS.ACTIVE}' THEN 1 END) as active,
        COUNT(CASE WHEN status = '${EMPLOYEE_STATUS.INACTIVE}' THEN 1 END) as inactive,
        COUNT(CASE WHEN status = '${EMPLOYEE_STATUS.TERMINATED}' THEN 1 END) as terminated,
        AVG(CASE WHEN status = '${EMPLOYEE_STATUS.ACTIVE}' THEN salary END) as average_salary,
        COUNT(CASE WHEN hire_date >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_hires,
        COUNT(CASE WHEN next_performance_review <= NOW() + INTERVAL '30 days' AND status = '${EMPLOYEE_STATUS.ACTIVE}' THEN 1 END) as upcoming_reviews
      FROM ${this.tableName}
    `;

    const departmentStatsQuery = `
      SELECT department, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = '${EMPLOYEE_STATUS.ACTIVE}'
      GROUP BY department
    `;

    const roleStatsQuery = `
      SELECT role, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = '${EMPLOYEE_STATUS.ACTIVE}'
      GROUP BY role
    `;

    const employmentTypeStatsQuery = `
      SELECT employment_type, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = '${EMPLOYEE_STATUS.ACTIVE}'
      GROUP BY employment_type
    `;

    const [stats, departmentStats, roleStats, employmentTypeStats] = await Promise.all([
      queryOne<{
        total: string;
        active: string;
        inactive: string;
        terminated: string;
        average_salary: string;
        recent_hires: string;
        upcoming_reviews: string;
      }>(statsQuery),
      queryMany<{ department: string; count: string }>(departmentStatsQuery),
      queryMany<{ role: string; count: string }>(roleStatsQuery),
      queryMany<{ employment_type: string; count: string }>(employmentTypeStatsQuery),
    ]);

    const byDepartment = departmentStats.reduce((acc, item) => {
      acc[item.department] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    const byRole = roleStats.reduce((acc, item) => {
      acc[item.role] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    const byEmploymentType = employmentTypeStats.reduce((acc, item) => {
      acc[item.employment_type] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      total: parseInt(stats?.total || '0', 10),
      active: parseInt(stats?.active || '0', 10),
      inactive: parseInt(stats?.inactive || '0', 10),
      terminated: parseInt(stats?.terminated || '0', 10),
      byDepartment,
      byRole,
      byEmploymentType,
      averageSalary: parseFloat(stats?.average_salary || '0'),
      recentHires: parseInt(stats?.recent_hires || '0', 10),
      upcomingReviews: parseInt(stats?.upcoming_reviews || '0', 10),
    };
  }

  /**
   * Delete employee (soft delete by setting status to inactive)
   */
  static async delete(id: string): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        status: EMPLOYEE_STATUS.INACTIVE,
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Hard delete employee (permanent deletion)
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
   * Parse JSON fields from database result
   */
  private static parseJsonFields(employee: Employee): Employee {
    return {
      ...employee,
      benefits: this.parseJsonField(employee.benefits),
      skills: this.parseJsonField(employee.skills),
      certifications: this.parseJsonField(employee.certifications),
      education: this.parseEducation(employee.education),
      shift_schedule: this.parseShiftSchedule(employee.shift_schedule),
    };
  }

  /**
   * Parse individual JSON field
   */
  private static parseJsonField(field: any): string[] {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return [];
      }
    }
    return Array.isArray(field) ? field : [];
  }

  /**
   * Parse education JSON field
   */
  private static parseEducation(field: any): any[] {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return [];
      }
    }
    return Array.isArray(field) ? field : [];
  }

  /**
   * Parse shift schedule JSON field
   */
  private static parseShiftSchedule(field: any): any {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return {};
      }
    }
    return field || {};
  }
}