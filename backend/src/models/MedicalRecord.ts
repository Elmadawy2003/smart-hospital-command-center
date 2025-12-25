import { query, queryOne, queryMany, buildSelectQuery, buildInsertQuery, buildUpdateQuery, buildDeleteQuery } from '@/utils/database';
import { MEDICAL_RECORD_STATUS, PRIORITY_LEVELS } from '@/utils/constants';
import { generateMedicalRecordNumber } from '@/utils/helpers';

export interface MedicalRecord {
  id: string;
  record_number: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  visit_date: Date;
  chief_complaint: string;
  history_of_present_illness: string;
  past_medical_history?: string;
  family_history?: string;
  social_history?: string;
  allergies?: string[];
  current_medications?: string[];
  physical_examination: string;
  vital_signs: {
    blood_pressure?: string;
    heart_rate?: number;
    respiratory_rate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    oxygen_saturation?: number;
  };
  assessment: string;
  diagnosis: string[];
  differential_diagnosis?: string[];
  treatment_plan: string;
  medications_prescribed?: {
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }[];
  lab_tests_ordered?: string[];
  imaging_ordered?: string[];
  procedures_performed?: string[];
  follow_up_instructions?: string;
  follow_up_date?: Date;
  referrals?: {
    specialist: string;
    department: string;
    reason: string;
    urgency: string;
  }[];
  discharge_summary?: string;
  status: string;
  priority: string;
  is_confidential: boolean;
  notes?: string;
  attachments?: string[];
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
}

export interface CreateMedicalRecordData {
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  visit_date: Date;
  chief_complaint: string;
  history_of_present_illness: string;
  past_medical_history?: string;
  family_history?: string;
  social_history?: string;
  allergies?: string[];
  current_medications?: string[];
  physical_examination: string;
  vital_signs: {
    blood_pressure?: string;
    heart_rate?: number;
    respiratory_rate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    oxygen_saturation?: number;
  };
  assessment: string;
  diagnosis: string[];
  differential_diagnosis?: string[];
  treatment_plan: string;
  medications_prescribed?: {
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }[];
  lab_tests_ordered?: string[];
  imaging_ordered?: string[];
  procedures_performed?: string[];
  follow_up_instructions?: string;
  follow_up_date?: Date;
  referrals?: {
    specialist: string;
    department: string;
    reason: string;
    urgency: string;
  }[];
  discharge_summary?: string;
  priority?: string;
  is_confidential?: boolean;
  notes?: string;
  attachments?: string[];
  created_by: string;
}

export interface UpdateMedicalRecordData {
  chief_complaint?: string;
  history_of_present_illness?: string;
  past_medical_history?: string;
  family_history?: string;
  social_history?: string;
  allergies?: string[];
  current_medications?: string[];
  physical_examination?: string;
  vital_signs?: {
    blood_pressure?: string;
    heart_rate?: number;
    respiratory_rate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    oxygen_saturation?: number;
  };
  assessment?: string;
  diagnosis?: string[];
  differential_diagnosis?: string[];
  treatment_plan?: string;
  medications_prescribed?: {
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }[];
  lab_tests_ordered?: string[];
  imaging_ordered?: string[];
  procedures_performed?: string[];
  follow_up_instructions?: string;
  follow_up_date?: Date;
  referrals?: {
    specialist: string;
    department: string;
    reason: string;
    urgency: string;
  }[];
  discharge_summary?: string;
  status?: string;
  priority?: string;
  is_confidential?: boolean;
  notes?: string;
  attachments?: string[];
  updated_by?: string;
}

export interface MedicalRecordFilters {
  patient_id?: string;
  doctor_id?: string;
  appointment_id?: string;
  status?: string;
  priority?: string;
  visit_date_from?: Date;
  visit_date_to?: Date;
  is_confidential?: boolean;
  diagnosis?: string;
  search?: string;
}

export class MedicalRecordModel {
  private static tableName = 'medical_records';

  /**
   * Create a new medical record
   */
  static async create(recordData: CreateMedicalRecordData): Promise<MedicalRecord> {
    const recordNumber = generateMedicalRecordNumber();
    
    const data = {
      record_number: recordNumber,
      patient_id: recordData.patient_id,
      doctor_id: recordData.doctor_id,
      appointment_id: recordData.appointment_id,
      visit_date: recordData.visit_date,
      chief_complaint: recordData.chief_complaint,
      history_of_present_illness: recordData.history_of_present_illness,
      past_medical_history: recordData.past_medical_history,
      family_history: recordData.family_history,
      social_history: recordData.social_history,
      allergies: JSON.stringify(recordData.allergies || []),
      current_medications: JSON.stringify(recordData.current_medications || []),
      physical_examination: recordData.physical_examination,
      vital_signs: JSON.stringify(recordData.vital_signs),
      assessment: recordData.assessment,
      diagnosis: JSON.stringify(recordData.diagnosis),
      differential_diagnosis: JSON.stringify(recordData.differential_diagnosis || []),
      treatment_plan: recordData.treatment_plan,
      medications_prescribed: JSON.stringify(recordData.medications_prescribed || []),
      lab_tests_ordered: JSON.stringify(recordData.lab_tests_ordered || []),
      imaging_ordered: JSON.stringify(recordData.imaging_ordered || []),
      procedures_performed: JSON.stringify(recordData.procedures_performed || []),
      follow_up_instructions: recordData.follow_up_instructions,
      follow_up_date: recordData.follow_up_date,
      referrals: JSON.stringify(recordData.referrals || []),
      discharge_summary: recordData.discharge_summary,
      status: MEDICAL_RECORD_STATUS.ACTIVE,
      priority: recordData.priority || PRIORITY_LEVELS.MEDIUM,
      is_confidential: recordData.is_confidential || false,
      notes: recordData.notes,
      attachments: JSON.stringify(recordData.attachments || []),
      created_at: new Date(),
      updated_at: new Date(),
      created_by: recordData.created_by,
    };

    const { query: insertQuery, values } = buildInsertQuery(this.tableName, data);
    const result = await queryOne<MedicalRecord>(insertQuery, values);
    
    if (!result) {
      throw new Error('Failed to create medical record');
    }

    return this.parseJsonFields(result);
  }

  /**
   * Find medical record by ID
   */
  static async findById(id: string): Promise<MedicalRecord | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { id }
    );
    
    const result = await queryOne<MedicalRecord>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find medical record by record number
   */
  static async findByRecordNumber(recordNumber: string): Promise<MedicalRecord | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { record_number: recordNumber }
    );
    
    const result = await queryOne<MedicalRecord>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find medical records with filters and pagination
   */
  static async findMany(
    filters: MedicalRecordFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'visit_date',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ records: MedicalRecord[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.patient_id) {
      whereClause += ` AND patient_id = $${paramIndex++}`;
      values.push(filters.patient_id);
    }

    if (filters.doctor_id) {
      whereClause += ` AND doctor_id = $${paramIndex++}`;
      values.push(filters.doctor_id);
    }

    if (filters.appointment_id) {
      whereClause += ` AND appointment_id = $${paramIndex++}`;
      values.push(filters.appointment_id);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.priority) {
      whereClause += ` AND priority = $${paramIndex++}`;
      values.push(filters.priority);
    }

    if (filters.visit_date_from) {
      whereClause += ` AND visit_date >= $${paramIndex++}`;
      values.push(filters.visit_date_from);
    }

    if (filters.visit_date_to) {
      whereClause += ` AND visit_date <= $${paramIndex++}`;
      values.push(filters.visit_date_to);
    }

    if (filters.is_confidential !== undefined) {
      whereClause += ` AND is_confidential = $${paramIndex++}`;
      values.push(filters.is_confidential);
    }

    if (filters.diagnosis) {
      whereClause += ` AND diagnosis::text ILIKE $${paramIndex++}`;
      values.push(`%${filters.diagnosis}%`);
    }

    if (filters.search) {
      whereClause += ` AND (
        record_number ILIKE $${paramIndex} OR 
        chief_complaint ILIKE $${paramIndex} OR
        assessment ILIKE $${paramIndex} OR
        diagnosis::text ILIKE $${paramIndex} OR
        notes ILIKE $${paramIndex}
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

    const records = await queryMany<MedicalRecord>(selectQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.tableName}
      ${whereClause}
    `;
    
    const countResult = await queryOne<{ total: string }>(countQuery, values.slice(0, -2));
    const total = parseInt(countResult?.total || '0', 10);

    return {
      records: records.map(record => this.parseJsonFields(record)),
      total
    };
  }

  /**
   * Update medical record
   */
  static async update(id: string, updateData: UpdateMedicalRecordData): Promise<MedicalRecord | null> {
    const data: Record<string, any> = {
      ...updateData,
      updated_at: new Date(),
    };

    // Handle JSON fields
    if (updateData.allergies) {
      data.allergies = JSON.stringify(updateData.allergies);
    }

    if (updateData.current_medications) {
      data.current_medications = JSON.stringify(updateData.current_medications);
    }

    if (updateData.vital_signs) {
      data.vital_signs = JSON.stringify(updateData.vital_signs);
    }

    if (updateData.diagnosis) {
      data.diagnosis = JSON.stringify(updateData.diagnosis);
    }

    if (updateData.differential_diagnosis) {
      data.differential_diagnosis = JSON.stringify(updateData.differential_diagnosis);
    }

    if (updateData.medications_prescribed) {
      data.medications_prescribed = JSON.stringify(updateData.medications_prescribed);
    }

    if (updateData.lab_tests_ordered) {
      data.lab_tests_ordered = JSON.stringify(updateData.lab_tests_ordered);
    }

    if (updateData.imaging_ordered) {
      data.imaging_ordered = JSON.stringify(updateData.imaging_ordered);
    }

    if (updateData.procedures_performed) {
      data.procedures_performed = JSON.stringify(updateData.procedures_performed);
    }

    if (updateData.referrals) {
      data.referrals = JSON.stringify(updateData.referrals);
    }

    if (updateData.attachments) {
      data.attachments = JSON.stringify(updateData.attachments);
    }

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<MedicalRecord>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Get patient's medical history
   */
  static async getPatientHistory(
    patientId: string,
    limit: number = 20,
    page: number = 1
  ): Promise<{ records: MedicalRecord[]; total: number }> {
    return this.findMany(
      { patient_id: patientId },
      page,
      limit,
      'visit_date',
      'DESC'
    );
  }

  /**
   * Get recent medical records for a doctor
   */
  static async getRecentByDoctor(
    doctorId: string,
    limit: number = 10
  ): Promise<MedicalRecord[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE doctor_id = $1
      ORDER BY visit_date DESC, created_at DESC
      LIMIT $2
    `;

    const records = await queryMany<MedicalRecord>(selectQuery, [doctorId, limit]);
    return records.map(record => this.parseJsonFields(record));
  }

  /**
   * Search medical records by diagnosis
   */
  static async searchByDiagnosis(
    diagnosis: string,
    limit: number = 20
  ): Promise<MedicalRecord[]> {
    const searchQuery = `
      SELECT * FROM ${this.tableName}
      WHERE diagnosis::text ILIKE $1
      ORDER BY visit_date DESC
      LIMIT $2
    `;

    const records = await queryMany<MedicalRecord>(searchQuery, [`%${diagnosis}%`, limit]);
    return records.map(record => this.parseJsonFields(record));
  }

  /**
   * Get medical records requiring follow-up
   */
  static async getFollowUpRequired(): Promise<MedicalRecord[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE follow_up_date IS NOT NULL 
        AND follow_up_date <= CURRENT_DATE + INTERVAL '7 days'
        AND status = '${MEDICAL_RECORD_STATUS.ACTIVE}'
      ORDER BY follow_up_date ASC
    `;

    const records = await queryMany<MedicalRecord>(selectQuery);
    return records.map(record => this.parseJsonFields(record));
  }

  /**
   * Get medical records with specific medications
   */
  static async findByMedication(medication: string): Promise<MedicalRecord[]> {
    const searchQuery = `
      SELECT * FROM ${this.tableName}
      WHERE medications_prescribed::text ILIKE $1
        OR current_medications::text ILIKE $1
      ORDER BY visit_date DESC
    `;

    const records = await queryMany<MedicalRecord>(searchQuery, [`%${medication}%`]);
    return records.map(record => this.parseJsonFields(record));
  }

  /**
   * Get confidential medical records (requires special permissions)
   */
  static async getConfidentialRecords(
    patientId: string,
    doctorId: string
  ): Promise<MedicalRecord[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE patient_id = $1 
        AND (doctor_id = $2 OR is_confidential = false)
      ORDER BY visit_date DESC
    `;

    const records = await queryMany<MedicalRecord>(selectQuery, [patientId, doctorId]);
    return records.map(record => this.parseJsonFields(record));
  }

  /**
   * Archive medical record
   */
  static async archive(id: string): Promise<MedicalRecord | null> {
    const data = {
      status: MEDICAL_RECORD_STATUS.ARCHIVED,
      updated_at: new Date(),
    };

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<MedicalRecord>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Delete medical record (soft delete by archiving)
   */
  static async delete(id: string): Promise<boolean> {
    const result = await this.archive(id);
    return !!result;
  }

  /**
   * Hard delete medical record (permanent deletion)
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
   * Get medical record statistics
   */
  static async getStatistics(dateFrom?: Date, dateTo?: Date): Promise<{
    total: number;
    active: number;
    archived: number;
    byPriority: Record<string, number>;
    confidentialCount: number;
    withFollowUp: number;
    recentRecords: number;
  }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereClause += ` AND visit_date >= $${paramIndex++}`;
      values.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND visit_date <= $${paramIndex++}`;
      values.push(dateTo);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = '${MEDICAL_RECORD_STATUS.ACTIVE}' THEN 1 END) as active,
        COUNT(CASE WHEN status = '${MEDICAL_RECORD_STATUS.ARCHIVED}' THEN 1 END) as archived,
        COUNT(CASE WHEN is_confidential = true THEN 1 END) as confidential_count,
        COUNT(CASE WHEN follow_up_date IS NOT NULL THEN 1 END) as with_follow_up,
        COUNT(CASE WHEN visit_date >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_records
      FROM ${this.tableName}
      ${whereClause}
    `;

    const priorityStatsQuery = `
      SELECT priority, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY priority
    `;

    const [stats, priorityStats] = await Promise.all([
      queryOne<{
        total: string;
        active: string;
        archived: string;
        confidential_count: string;
        with_follow_up: string;
        recent_records: string;
      }>(statsQuery, values),
      queryMany<{ priority: string; count: string }>(priorityStatsQuery, values),
    ]);

    const byPriority = priorityStats.reduce((acc, item) => {
      acc[item.priority] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      total: parseInt(stats?.total || '0', 10),
      active: parseInt(stats?.active || '0', 10),
      archived: parseInt(stats?.archived || '0', 10),
      byPriority,
      confidentialCount: parseInt(stats?.confidential_count || '0', 10),
      withFollowUp: parseInt(stats?.with_follow_up || '0', 10),
      recentRecords: parseInt(stats?.recent_records || '0', 10),
    };
  }

  /**
   * Parse JSON fields from database result
   */
  private static parseJsonFields(record: MedicalRecord): MedicalRecord {
    return {
      ...record,
      allergies: this.parseJsonField(record.allergies),
      current_medications: this.parseJsonField(record.current_medications),
      vital_signs: this.parseVitalSigns(record.vital_signs),
      diagnosis: this.parseJsonField(record.diagnosis),
      differential_diagnosis: this.parseJsonField(record.differential_diagnosis),
      medications_prescribed: this.parseMedicationsPrescribed(record.medications_prescribed),
      lab_tests_ordered: this.parseJsonField(record.lab_tests_ordered),
      imaging_ordered: this.parseJsonField(record.imaging_ordered),
      procedures_performed: this.parseJsonField(record.procedures_performed),
      referrals: this.parseReferrals(record.referrals),
      attachments: this.parseJsonField(record.attachments),
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
   * Parse vital signs JSON field
   */
  private static parseVitalSigns(field: any): any {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return {};
      }
    }
    return field || {};
  }

  /**
   * Parse medications prescribed JSON field
   */
  private static parseMedicationsPrescribed(field: any): any[] {
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
   * Parse referrals JSON field
   */
  private static parseReferrals(field: any): any[] {
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