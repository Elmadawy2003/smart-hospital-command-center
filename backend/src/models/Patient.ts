import { query, queryOne, queryMany, buildSelectQuery, buildInsertQuery, buildUpdateQuery, buildDeleteQuery } from '@/utils/database';
import { PATIENT_STATUS, GENDER, BLOOD_TYPES, MARITAL_STATUS } from '@/utils/constants';
import { generateMRN, calculateAge } from '@/utils/helpers';

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  age: number;
  gender: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  blood_type?: string;
  marital_status?: string;
  occupation?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_group_number?: string;
  primary_care_physician?: string;
  allergies?: string[];
  medical_conditions?: string[];
  current_medications?: string[];
  status: string;
  notes?: string;
  profile_image?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreatePatientData {
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  gender: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  blood_type?: string;
  marital_status?: string;
  occupation?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_group_number?: string;
  primary_care_physician?: string;
  allergies?: string[];
  medical_conditions?: string[];
  current_medications?: string[];
  notes?: string;
  created_by?: string;
}

export interface UpdatePatientData {
  first_name?: string;
  last_name?: string;
  date_of_birth?: Date;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  blood_type?: string;
  marital_status?: string;
  occupation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_group_number?: string;
  primary_care_physician?: string;
  allergies?: string[];
  medical_conditions?: string[];
  current_medications?: string[];
  status?: string;
  notes?: string;
  updated_by?: string;
}

export interface PatientFilters {
  status?: string;
  gender?: string;
  blood_type?: string;
  age_min?: number;
  age_max?: number;
  city?: string;
  state?: string;
  insurance_provider?: string;
  search?: string;
  created_from?: Date;
  created_to?: Date;
}

export class PatientModel {
  private static tableName = 'patients';

  /**
   * Create a new patient
   */
  static async create(patientData: CreatePatientData): Promise<Patient> {
    const mrn = generateMRN();
    const age = calculateAge(patientData.date_of_birth);
    
    const data = {
      mrn,
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      date_of_birth: patientData.date_of_birth,
      age,
      gender: patientData.gender,
      phone: patientData.phone,
      email: patientData.email?.toLowerCase(),
      address: patientData.address,
      city: patientData.city,
      state: patientData.state,
      zip_code: patientData.zip_code,
      country: patientData.country,
      blood_type: patientData.blood_type,
      marital_status: patientData.marital_status,
      occupation: patientData.occupation,
      emergency_contact_name: patientData.emergency_contact_name,
      emergency_contact_phone: patientData.emergency_contact_phone,
      emergency_contact_relationship: patientData.emergency_contact_relationship,
      insurance_provider: patientData.insurance_provider,
      insurance_policy_number: patientData.insurance_policy_number,
      insurance_group_number: patientData.insurance_group_number,
      primary_care_physician: patientData.primary_care_physician,
      allergies: JSON.stringify(patientData.allergies || []),
      medical_conditions: JSON.stringify(patientData.medical_conditions || []),
      current_medications: JSON.stringify(patientData.current_medications || []),
      status: PATIENT_STATUS.ACTIVE,
      notes: patientData.notes,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: patientData.created_by,
    };

    const { query: insertQuery, values } = buildInsertQuery(this.tableName, data);
    const result = await queryOne<Patient>(insertQuery, values);
    
    if (!result) {
      throw new Error('Failed to create patient');
    }

    // Parse JSON fields
    return this.parseJsonFields(result);
  }

  /**
   * Find patient by ID
   */
  static async findById(id: string): Promise<Patient | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { id }
    );
    
    const result = await queryOne<Patient>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find patient by MRN
   */
  static async findByMRN(mrn: string): Promise<Patient | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { mrn }
    );
    
    const result = await queryOne<Patient>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find patients with filters and pagination
   */
  static async findMany(
    filters: PatientFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ patients: Patient[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.gender) {
      whereClause += ` AND gender = $${paramIndex++}`;
      values.push(filters.gender);
    }

    if (filters.blood_type) {
      whereClause += ` AND blood_type = $${paramIndex++}`;
      values.push(filters.blood_type);
    }

    if (filters.age_min !== undefined) {
      whereClause += ` AND age >= $${paramIndex++}`;
      values.push(filters.age_min);
    }

    if (filters.age_max !== undefined) {
      whereClause += ` AND age <= $${paramIndex++}`;
      values.push(filters.age_max);
    }

    if (filters.city) {
      whereClause += ` AND city ILIKE $${paramIndex++}`;
      values.push(`%${filters.city}%`);
    }

    if (filters.state) {
      whereClause += ` AND state ILIKE $${paramIndex++}`;
      values.push(`%${filters.state}%`);
    }

    if (filters.insurance_provider) {
      whereClause += ` AND insurance_provider ILIKE $${paramIndex++}`;
      values.push(`%${filters.insurance_provider}%`);
    }

    if (filters.search) {
      whereClause += ` AND (
        first_name ILIKE $${paramIndex} OR 
        last_name ILIKE $${paramIndex} OR 
        mrn ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex}
      )`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.created_from) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      values.push(filters.created_from);
    }

    if (filters.created_to) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      values.push(filters.created_to);
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

    const patients = await queryMany<Patient>(selectQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.tableName}
      ${whereClause}
    `;
    
    const countResult = await queryOne<{ total: string }>(countQuery, values.slice(0, -2));
    const total = parseInt(countResult?.total || '0', 10);

    return {
      patients: patients.map(patient => this.parseJsonFields(patient)),
      total
    };
  }

  /**
   * Update patient
   */
  static async update(id: string, updateData: UpdatePatientData): Promise<Patient | null> {
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

    if (updateData.allergies) {
      data.allergies = JSON.stringify(updateData.allergies);
    }

    if (updateData.medical_conditions) {
      data.medical_conditions = JSON.stringify(updateData.medical_conditions);
    }

    if (updateData.current_medications) {
      data.current_medications = JSON.stringify(updateData.current_medications);
    }

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<Patient>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Delete patient (soft delete by setting status to inactive)
   */
  static async delete(id: string): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        status: PATIENT_STATUS.INACTIVE,
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Hard delete patient (permanent deletion)
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
   * Search patients by name or MRN
   */
  static async search(searchTerm: string, limit: number = 10): Promise<Patient[]> {
    const searchQuery = `
      SELECT * FROM ${this.tableName}
      WHERE (
        first_name ILIKE $1 OR 
        last_name ILIKE $1 OR 
        mrn ILIKE $1 OR
        CONCAT(first_name, ' ', last_name) ILIKE $1
      )
      AND status = $2
      ORDER BY 
        CASE 
          WHEN mrn ILIKE $1 THEN 1
          WHEN first_name ILIKE $1 THEN 2
          WHEN last_name ILIKE $1 THEN 3
          ELSE 4
        END,
        first_name, last_name
      LIMIT $3
    `;

    const patients = await queryMany<Patient>(searchQuery, [
      `%${searchTerm}%`,
      PATIENT_STATUS.ACTIVE,
      limit
    ]);

    return patients.map(patient => this.parseJsonFields(patient));
  }

  /**
   * Get patients by age range
   */
  static async findByAgeRange(minAge: number, maxAge: number): Promise<Patient[]> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      {
        age: { operator: '>=', value: minAge },
        status: PATIENT_STATUS.ACTIVE
      }
    );

    // Add additional age filter
    const modifiedQuery = selectQuery.replace(
      'WHERE age >= $1 AND status = $2',
      'WHERE age >= $1 AND age <= $3 AND status = $2'
    );

    const patients = await queryMany<Patient>(modifiedQuery, [minAge, PATIENT_STATUS.ACTIVE, maxAge]);
    return patients.map(patient => this.parseJsonFields(patient));
  }

  /**
   * Get patients by blood type
   */
  static async findByBloodType(bloodType: string): Promise<Patient[]> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { blood_type: bloodType, status: PATIENT_STATUS.ACTIVE }
    );

    const patients = await queryMany<Patient>(selectQuery, values);
    return patients.map(patient => this.parseJsonFields(patient));
  }

  /**
   * Check if MRN exists
   */
  static async mrnExists(mrn: string, excludeId?: string): Promise<boolean> {
    const conditions: Record<string, any> = { mrn };

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
   * Get patient statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byGender: Record<string, number>;
    byBloodType: Record<string, number>;
    byAgeGroup: Record<string, number>;
    recentRegistrations: number;
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = '${PATIENT_STATUS.ACTIVE}' THEN 1 END) as active,
        COUNT(CASE WHEN status = '${PATIENT_STATUS.INACTIVE}' THEN 1 END) as inactive,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_registrations
      FROM ${this.tableName}
    `;

    const genderStatsQuery = `
      SELECT gender, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = '${PATIENT_STATUS.ACTIVE}'
      GROUP BY gender
    `;

    const bloodTypeStatsQuery = `
      SELECT blood_type, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = '${PATIENT_STATUS.ACTIVE}' AND blood_type IS NOT NULL
      GROUP BY blood_type
    `;

    const ageGroupStatsQuery = `
      SELECT 
        CASE 
          WHEN age < 18 THEN 'Under 18'
          WHEN age BETWEEN 18 AND 30 THEN '18-30'
          WHEN age BETWEEN 31 AND 50 THEN '31-50'
          WHEN age BETWEEN 51 AND 70 THEN '51-70'
          ELSE 'Over 70'
        END as age_group,
        COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = '${PATIENT_STATUS.ACTIVE}'
      GROUP BY age_group
    `;

    const [stats, genderStats, bloodTypeStats, ageGroupStats] = await Promise.all([
      queryOne<{
        total: string;
        active: string;
        inactive: string;
        recent_registrations: string;
      }>(statsQuery),
      queryMany<{ gender: string; count: string }>(genderStatsQuery),
      queryMany<{ blood_type: string; count: string }>(bloodTypeStatsQuery),
      queryMany<{ age_group: string; count: string }>(ageGroupStatsQuery),
    ]);

    const byGender = genderStats.reduce((acc, item) => {
      acc[item.gender] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    const byBloodType = bloodTypeStats.reduce((acc, item) => {
      acc[item.blood_type] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    const byAgeGroup = ageGroupStats.reduce((acc, item) => {
      acc[item.age_group] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      total: parseInt(stats?.total || '0', 10),
      active: parseInt(stats?.active || '0', 10),
      inactive: parseInt(stats?.inactive || '0', 10),
      byGender,
      byBloodType,
      byAgeGroup,
      recentRegistrations: parseInt(stats?.recent_registrations || '0', 10),
    };
  }

  /**
   * Parse JSON fields from database result
   */
  private static parseJsonFields(patient: Patient): Patient {
    return {
      ...patient,
      allergies: this.parseJsonField(patient.allergies),
      medical_conditions: this.parseJsonField(patient.medical_conditions),
      current_medications: this.parseJsonField(patient.current_medications),
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
}