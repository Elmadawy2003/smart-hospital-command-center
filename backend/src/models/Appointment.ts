import { query, queryOne, queryMany, buildSelectQuery, buildInsertQuery, buildUpdateQuery, buildDeleteQuery } from '@/utils/database';
import { APPOINTMENT_STATUS, APPOINTMENT_TYPES, PRIORITY_LEVELS } from '@/utils/constants';
import { generateAppointmentId, isValidAppointmentTime } from '@/utils/helpers';

export interface Appointment {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  department_id?: string;
  appointment_date: Date;
  appointment_time: string;
  duration_minutes: number;
  type: string;
  status: string;
  priority: string;
  reason: string;
  notes?: string;
  symptoms?: string[];
  vital_signs?: {
    blood_pressure?: string;
    heart_rate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
  diagnosis?: string;
  treatment_plan?: string;
  prescription?: string;
  follow_up_date?: Date;
  follow_up_instructions?: string;
  room_number?: string;
  is_emergency: boolean;
  is_follow_up: boolean;
  parent_appointment_id?: string;
  cancelled_reason?: string;
  cancelled_by?: string;
  cancelled_at?: Date;
  checked_in_at?: Date;
  checked_out_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreateAppointmentData {
  patient_id: string;
  doctor_id: string;
  department_id?: string;
  appointment_date: Date;
  appointment_time: string;
  duration_minutes?: number;
  type: string;
  priority?: string;
  reason: string;
  notes?: string;
  symptoms?: string[];
  room_number?: string;
  is_emergency?: boolean;
  is_follow_up?: boolean;
  parent_appointment_id?: string;
  created_by?: string;
}

export interface UpdateAppointmentData {
  doctor_id?: string;
  department_id?: string;
  appointment_date?: Date;
  appointment_time?: string;
  duration_minutes?: number;
  type?: string;
  status?: string;
  priority?: string;
  reason?: string;
  notes?: string;
  symptoms?: string[];
  vital_signs?: {
    blood_pressure?: string;
    heart_rate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
  diagnosis?: string;
  treatment_plan?: string;
  prescription?: string;
  follow_up_date?: Date;
  follow_up_instructions?: string;
  room_number?: string;
  is_emergency?: boolean;
  cancelled_reason?: string;
  cancelled_by?: string;
  updated_by?: string;
}

export interface AppointmentFilters {
  patient_id?: string;
  doctor_id?: string;
  department_id?: string;
  status?: string;
  type?: string;
  priority?: string;
  date_from?: Date;
  date_to?: Date;
  is_emergency?: boolean;
  is_follow_up?: boolean;
  room_number?: string;
  search?: string;
}

export class AppointmentModel {
  private static tableName = 'appointments';

  /**
   * Create a new appointment
   */
  static async create(appointmentData: CreateAppointmentData): Promise<Appointment> {
    // Validate appointment time
    const appointmentDateTime = new Date(appointmentData.appointment_date);
    const [hours, minutes] = appointmentData.appointment_time.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    if (!isValidAppointmentTime(appointmentDateTime)) {
      throw new Error('Invalid appointment time. Must be during business hours and not in the past.');
    }

    // Check for conflicts
    const hasConflict = await this.checkTimeConflict(
      appointmentData.doctor_id,
      appointmentData.appointment_date,
      appointmentData.appointment_time,
      appointmentData.duration_minutes || 30
    );

    if (hasConflict) {
      throw new Error('Doctor is not available at the requested time.');
    }

    const appointmentId = generateAppointmentId();
    
    const data = {
      appointment_id: appointmentId,
      patient_id: appointmentData.patient_id,
      doctor_id: appointmentData.doctor_id,
      department_id: appointmentData.department_id,
      appointment_date: appointmentData.appointment_date,
      appointment_time: appointmentData.appointment_time,
      duration_minutes: appointmentData.duration_minutes || 30,
      type: appointmentData.type,
      status: APPOINTMENT_STATUS.SCHEDULED,
      priority: appointmentData.priority || PRIORITY_LEVELS.MEDIUM,
      reason: appointmentData.reason,
      notes: appointmentData.notes,
      symptoms: JSON.stringify(appointmentData.symptoms || []),
      room_number: appointmentData.room_number,
      is_emergency: appointmentData.is_emergency || false,
      is_follow_up: appointmentData.is_follow_up || false,
      parent_appointment_id: appointmentData.parent_appointment_id,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: appointmentData.created_by,
    };

    const { query: insertQuery, values } = buildInsertQuery(this.tableName, data);
    const result = await queryOne<Appointment>(insertQuery, values);
    
    if (!result) {
      throw new Error('Failed to create appointment');
    }

    return this.parseJsonFields(result);
  }

  /**
   * Find appointment by ID
   */
  static async findById(id: string): Promise<Appointment | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { id }
    );
    
    const result = await queryOne<Appointment>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find appointment by appointment ID
   */
  static async findByAppointmentId(appointmentId: string): Promise<Appointment | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.tableName,
      ['*'],
      { appointment_id: appointmentId }
    );
    
    const result = await queryOne<Appointment>(selectQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Find appointments with filters and pagination
   */
  static async findMany(
    filters: AppointmentFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'appointment_date',
    sortOrder: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ appointments: Appointment[]; total: number }> {
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

    if (filters.department_id) {
      whereClause += ` AND department_id = $${paramIndex++}`;
      values.push(filters.department_id);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.type) {
      whereClause += ` AND type = $${paramIndex++}`;
      values.push(filters.type);
    }

    if (filters.priority) {
      whereClause += ` AND priority = $${paramIndex++}`;
      values.push(filters.priority);
    }

    if (filters.date_from) {
      whereClause += ` AND appointment_date >= $${paramIndex++}`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      whereClause += ` AND appointment_date <= $${paramIndex++}`;
      values.push(filters.date_to);
    }

    if (filters.is_emergency !== undefined) {
      whereClause += ` AND is_emergency = $${paramIndex++}`;
      values.push(filters.is_emergency);
    }

    if (filters.is_follow_up !== undefined) {
      whereClause += ` AND is_follow_up = $${paramIndex++}`;
      values.push(filters.is_follow_up);
    }

    if (filters.room_number) {
      whereClause += ` AND room_number = $${paramIndex++}`;
      values.push(filters.room_number);
    }

    if (filters.search) {
      whereClause += ` AND (
        appointment_id ILIKE $${paramIndex} OR 
        reason ILIKE $${paramIndex} OR
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

    const appointments = await queryMany<Appointment>(selectQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.tableName}
      ${whereClause}
    `;
    
    const countResult = await queryOne<{ total: string }>(countQuery, values.slice(0, -2));
    const total = parseInt(countResult?.total || '0', 10);

    return {
      appointments: appointments.map(appointment => this.parseJsonFields(appointment)),
      total
    };
  }

  /**
   * Update appointment
   */
  static async update(id: string, updateData: UpdateAppointmentData): Promise<Appointment | null> {
    const data: Record<string, any> = {
      ...updateData,
      updated_at: new Date(),
    };

    // Validate appointment time if being updated
    if (updateData.appointment_date && updateData.appointment_time) {
      const appointmentDateTime = new Date(updateData.appointment_date);
      const [hours, minutes] = updateData.appointment_time.split(':').map(Number);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      if (!isValidAppointmentTime(appointmentDateTime)) {
        throw new Error('Invalid appointment time. Must be during business hours and not in the past.');
      }

      // Check for conflicts if doctor or time is being changed
      if (updateData.doctor_id || updateData.appointment_date || updateData.appointment_time) {
        const currentAppointment = await this.findById(id);
        if (!currentAppointment) {
          throw new Error('Appointment not found');
        }

        const doctorId = updateData.doctor_id || currentAppointment.doctor_id;
        const appointmentDate = updateData.appointment_date || currentAppointment.appointment_date;
        const appointmentTime = updateData.appointment_time || currentAppointment.appointment_time;
        const duration = updateData.duration_minutes || currentAppointment.duration_minutes;

        const hasConflict = await this.checkTimeConflict(
          doctorId,
          appointmentDate,
          appointmentTime,
          duration,
          id
        );

        if (hasConflict) {
          throw new Error('Doctor is not available at the requested time.');
        }
      }
    }

    if (updateData.symptoms) {
      data.symptoms = JSON.stringify(updateData.symptoms);
    }

    if (updateData.vital_signs) {
      data.vital_signs = JSON.stringify(updateData.vital_signs);
    }

    // Handle cancellation
    if (updateData.status === APPOINTMENT_STATUS.CANCELLED) {
      data.cancelled_at = new Date();
      data.cancelled_by = updateData.cancelled_by;
      data.cancelled_reason = updateData.cancelled_reason;
    }

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<Appointment>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Check in patient for appointment
   */
  static async checkIn(id: string): Promise<Appointment | null> {
    const data = {
      status: APPOINTMENT_STATUS.CHECKED_IN,
      checked_in_at: new Date(),
      updated_at: new Date(),
    };

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<Appointment>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Check out patient from appointment
   */
  static async checkOut(id: string): Promise<Appointment | null> {
    const data = {
      status: APPOINTMENT_STATUS.COMPLETED,
      checked_out_at: new Date(),
      updated_at: new Date(),
    };

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<Appointment>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Cancel appointment
   */
  static async cancel(id: string, reason: string, cancelledBy: string): Promise<Appointment | null> {
    const data = {
      status: APPOINTMENT_STATUS.CANCELLED,
      cancelled_reason: reason,
      cancelled_by: cancelledBy,
      cancelled_at: new Date(),
      updated_at: new Date(),
    };

    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      data,
      { id }
    );

    const result = await queryOne<Appointment>(updateQuery, values);
    return result ? this.parseJsonFields(result) : null;
  }

  /**
   * Get appointments for a specific date
   */
  static async findByDate(date: Date, doctorId?: string): Promise<Appointment[]> {
    let whereClause = 'WHERE appointment_date = $1';
    const values: any[] = [date];

    if (doctorId) {
      whereClause += ' AND doctor_id = $2';
      values.push(doctorId);
    }

    const selectQuery = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ORDER BY appointment_time ASC
    `;

    const appointments = await queryMany<Appointment>(selectQuery, values);
    return appointments.map(appointment => this.parseJsonFields(appointment));
  }

  /**
   * Get upcoming appointments for a patient
   */
  static async findUpcomingByPatient(patientId: string, limit: number = 5): Promise<Appointment[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE patient_id = $1 
        AND appointment_date >= CURRENT_DATE
        AND status NOT IN ('${APPOINTMENT_STATUS.CANCELLED}', '${APPOINTMENT_STATUS.COMPLETED}')
      ORDER BY appointment_date ASC, appointment_time ASC
      LIMIT $2
    `;

    const appointments = await queryMany<Appointment>(selectQuery, [patientId, limit]);
    return appointments.map(appointment => this.parseJsonFields(appointment));
  }

  /**
   * Get today's appointments for a doctor
   */
  static async findTodayByDoctor(doctorId: string): Promise<Appointment[]> {
    const selectQuery = `
      SELECT * FROM ${this.tableName}
      WHERE doctor_id = $1 
        AND appointment_date = CURRENT_DATE
        AND status NOT IN ('${APPOINTMENT_STATUS.CANCELLED}')
      ORDER BY appointment_time ASC
    `;

    const appointments = await queryMany<Appointment>(selectQuery, [doctorId]);
    return appointments.map(appointment => this.parseJsonFields(appointment));
  }

  /**
   * Check for time conflicts
   */
  static async checkTimeConflict(
    doctorId: string,
    appointmentDate: Date,
    appointmentTime: string,
    durationMinutes: number,
    excludeAppointmentId?: string
  ): Promise<boolean> {
    const [hours, minutes] = appointmentTime.split(':').map(Number);
    const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // Calculate end time
    const endMinutes = minutes + durationMinutes;
    const endHours = hours + Math.floor(endMinutes / 60);
    const finalMinutes = endMinutes % 60;
    const endTime = `${endHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;

    let whereClause = `
      WHERE doctor_id = $1 
        AND appointment_date = $2
        AND status NOT IN ('${APPOINTMENT_STATUS.CANCELLED}')
        AND (
          (appointment_time <= $3 AND 
           (appointment_time + INTERVAL '1 minute' * duration_minutes) > $3) OR
          (appointment_time < $4 AND 
           (appointment_time + INTERVAL '1 minute' * duration_minutes) >= $4) OR
          (appointment_time >= $3 AND appointment_time < $4)
        )
    `;

    const values: any[] = [doctorId, appointmentDate, startTime, endTime];

    if (excludeAppointmentId) {
      whereClause += ' AND id != $5';
      values.push(excludeAppointmentId);
    }

    const conflictQuery = `
      SELECT id FROM ${this.tableName}
      ${whereClause}
      LIMIT 1
    `;

    const result = await queryOne(conflictQuery, values);
    return !!result;
  }

  /**
   * Get appointment statistics
   */
  static async getStatistics(dateFrom?: Date, dateTo?: Date): Promise<{
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    checkedIn: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    emergencyCount: number;
    followUpCount: number;
  }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereClause += ` AND appointment_date >= $${paramIndex++}`;
      values.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND appointment_date <= $${paramIndex++}`;
      values.push(dateTo);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = '${APPOINTMENT_STATUS.SCHEDULED}' THEN 1 END) as scheduled,
        COUNT(CASE WHEN status = '${APPOINTMENT_STATUS.COMPLETED}' THEN 1 END) as completed,
        COUNT(CASE WHEN status = '${APPOINTMENT_STATUS.CANCELLED}' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status = '${APPOINTMENT_STATUS.CHECKED_IN}' THEN 1 END) as checked_in,
        COUNT(CASE WHEN is_emergency = true THEN 1 END) as emergency_count,
        COUNT(CASE WHEN is_follow_up = true THEN 1 END) as follow_up_count
      FROM ${this.tableName}
      ${whereClause}
    `;

    const typeStatsQuery = `
      SELECT type, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY type
    `;

    const priorityStatsQuery = `
      SELECT priority, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY priority
    `;

    const statusStatsQuery = `
      SELECT status, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY status
    `;

    const [stats, typeStats, priorityStats, statusStats] = await Promise.all([
      queryOne<{
        total: string;
        scheduled: string;
        completed: string;
        cancelled: string;
        checked_in: string;
        emergency_count: string;
        follow_up_count: string;
      }>(statsQuery, values),
      queryMany<{ type: string; count: string }>(typeStatsQuery, values),
      queryMany<{ priority: string; count: string }>(priorityStatsQuery, values),
      queryMany<{ status: string; count: string }>(statusStatsQuery, values),
    ]);

    const byType = typeStats.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    const byPriority = priorityStats.reduce((acc, item) => {
      acc[item.priority] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    const byStatus = statusStats.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      total: parseInt(stats?.total || '0', 10),
      scheduled: parseInt(stats?.scheduled || '0', 10),
      completed: parseInt(stats?.completed || '0', 10),
      cancelled: parseInt(stats?.cancelled || '0', 10),
      checkedIn: parseInt(stats?.checked_in || '0', 10),
      byType,
      byPriority,
      byStatus,
      emergencyCount: parseInt(stats?.emergency_count || '0', 10),
      followUpCount: parseInt(stats?.follow_up_count || '0', 10),
    };
  }

  /**
   * Delete appointment (soft delete by setting status to cancelled)
   */
  static async delete(id: string): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.tableName,
      {
        status: APPOINTMENT_STATUS.CANCELLED,
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Hard delete appointment (permanent deletion)
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
  private static parseJsonFields(appointment: Appointment): Appointment {
    return {
      ...appointment,
      symptoms: this.parseJsonField(appointment.symptoms),
      vital_signs: this.parseVitalSigns(appointment.vital_signs),
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
}