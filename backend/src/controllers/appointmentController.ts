import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { Appointment, APIResponse, PaginatedResponse, AppointmentStatus, AppointmentType } from '@/types';

export const createAppointment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const {
    patientId,
    doctorId,
    appointmentDate,
    duration = 30,
    type,
    notes,
    roomNumber
  } = req.body;

  try {
    const db = getDatabase();
    const appointmentId = uuidv4();

    // Validate patient exists
    const patientCheck = await db.query(
      'SELECT id FROM patients WHERE id = $1 AND is_active = true',
      [patientId]
    );
    if (patientCheck.rows.length === 0) {
      throw new CustomError('Patient not found', 404);
    }

    // Validate doctor exists
    const doctorCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [doctorId, 'doctor']
    );
    if (doctorCheck.rows.length === 0) {
      throw new CustomError('Doctor not found', 404);
    }

    // Check for scheduling conflicts
    const appointmentDateTime = new Date(appointmentDate);
    const endDateTime = new Date(appointmentDateTime.getTime() + duration * 60000);

    const conflictCheck = await db.query(`
      SELECT id FROM appointments 
      WHERE doctor_id = $1 
      AND status NOT IN ('cancelled', 'completed')
      AND (
        (appointment_date <= $2 AND appointment_date + INTERVAL '1 minute' * duration > $2) OR
        (appointment_date < $3 AND appointment_date + INTERVAL '1 minute' * duration >= $3) OR
        (appointment_date >= $2 AND appointment_date < $3)
      )
    `, [doctorId, appointmentDateTime, endDateTime]);

    if (conflictCheck.rows.length > 0) {
      throw new CustomError('Doctor is not available at the requested time', 409);
    }

    // Check room availability if room is specified
    if (roomNumber) {
      const roomConflictCheck = await db.query(`
        SELECT id FROM appointments 
        WHERE room_number = $1 
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (appointment_date <= $2 AND appointment_date + INTERVAL '1 minute' * duration > $2) OR
          (appointment_date < $3 AND appointment_date + INTERVAL '1 minute' * duration >= $3) OR
          (appointment_date >= $2 AND appointment_date < $3)
        )
      `, [roomNumber, appointmentDateTime, endDateTime]);

      if (roomConflictCheck.rows.length > 0) {
        throw new CustomError('Room is not available at the requested time', 409);
      }
    }

    const insertQuery = `
      INSERT INTO appointments (
        id, patient_id, doctor_id, appointment_date, duration, type, 
        status, notes, room_number, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      appointmentId,
      patientId,
      doctorId,
      appointmentDateTime,
      duration,
      type,
      AppointmentStatus.SCHEDULED,
      notes,
      roomNumber,
      req.user?.id,
      new Date(),
      new Date()
    ];

    const result = await db.query(insertQuery, values);
    const appointment = result.rows[0];

    // Cache the appointment
    await setCache(`appointment:${appointmentId}`, appointment, 3600);

    logger.info('Appointment created successfully', {
      appointmentId,
      patientId,
      doctorId,
      createdBy: req.user?.id
    });

    const response: APIResponse<Appointment> = {
      success: true,
      data: appointment,
      message: 'Appointment created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating appointment:', error);
    throw error;
  }
};

export const getAppointments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const doctorId = req.query.doctorId as string;
    const patientId = req.query.patientId as string;
    const date = req.query.date as string;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND a.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (doctorId) {
      paramCount++;
      whereClause += ` AND a.doctor_id = $${paramCount}`;
      queryParams.push(doctorId);
    }

    if (patientId) {
      paramCount++;
      whereClause += ` AND a.patient_id = $${paramCount}`;
      queryParams.push(patientId);
    }

    if (date) {
      paramCount++;
      whereClause += ` AND DATE(a.appointment_date) = $${paramCount}`;
      queryParams.push(date);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM appointments a 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get appointments with patient and doctor details
    const appointmentsQuery = `
      SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.patient_number,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        dept.name as department_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users d ON a.doctor_id = d.id
      LEFT JOIN departments dept ON d.department = dept.id
      ${whereClause}
      ORDER BY a.appointment_date ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const appointmentsResult = await db.query(appointmentsQuery, queryParams);

    const response: PaginatedResponse<Appointment> = {
      success: true,
      data: appointmentsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching appointments:', error);
    throw error;
  }
};

export const getAppointmentById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Try to get from cache first
    const cachedAppointment = await getCache<Appointment>(`appointment:${id}`);
    if (cachedAppointment) {
      const response: APIResponse<Appointment> = {
        success: true,
        data: cachedAppointment,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();
    const query = `
      SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.patient_number,
        p.phone as patient_phone,
        p.email as patient_email,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        dept.name as department_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users d ON a.doctor_id = d.id
      LEFT JOIN departments dept ON d.department = dept.id
      WHERE a.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new CustomError('Appointment not found', 404);
    }

    const appointment = result.rows[0];
    
    // Cache the appointment
    await setCache(`appointment:${id}`, appointment, 3600);

    const response: APIResponse<Appointment> = {
      success: true,
      data: appointment,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching appointment:', error);
    throw error;
  }
};

export const updateAppointment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { id } = req.params;
  const updateData = req.body;

  try {
    const db = getDatabase();

    // Check if appointment exists
    const existingAppointment = await db.query(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );

    if (existingAppointment.rows.length === 0) {
      throw new CustomError('Appointment not found', 404);
    }

    const currentAppointment = existingAppointment.rows[0];

    // Check if appointment can be updated based on status
    if (currentAppointment.status === 'completed' && updateData.status !== 'completed') {
      throw new CustomError('Cannot modify completed appointment', 400);
    }

    // If updating appointment time or doctor, check for conflicts
    if (updateData.appointmentDate || updateData.doctorId || updateData.duration) {
      const doctorId = updateData.doctorId || currentAppointment.doctor_id;
      const appointmentDate = updateData.appointmentDate || currentAppointment.appointment_date;
      const duration = updateData.duration || currentAppointment.duration;

      const appointmentDateTime = new Date(appointmentDate);
      const endDateTime = new Date(appointmentDateTime.getTime() + duration * 60000);

      const conflictCheck = await db.query(`
        SELECT id FROM appointments 
        WHERE doctor_id = $1 
        AND id != $2
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (appointment_date <= $3 AND appointment_date + INTERVAL '1 minute' * duration > $3) OR
          (appointment_date < $4 AND appointment_date + INTERVAL '1 minute' * duration >= $4) OR
          (appointment_date >= $3 AND appointment_date < $4)
        )
      `, [doctorId, id, appointmentDateTime, endDateTime]);

      if (conflictCheck.rows.length > 0) {
        throw new CustomError('Doctor is not available at the requested time', 409);
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id') {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
      }
    });

    if (updateFields.length === 0) {
      throw new CustomError('No valid fields to update', 400);
    }

    // Add updated_at
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add id for WHERE clause
    paramCount++;
    values.push(id);

    const updateQuery = `
      UPDATE appointments 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedAppointment = result.rows[0];

    // Update cache
    await setCache(`appointment:${id}`, updatedAppointment, 3600);

    logger.info('Appointment updated successfully', {
      appointmentId: id,
      updatedBy: req.user?.id,
      updatedFields: Object.keys(updateData)
    });

    const response: APIResponse<Appointment> = {
      success: true,
      data: updatedAppointment,
      message: 'Appointment updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating appointment:', error);
    throw error;
  }
};

export const cancelAppointment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const db = getDatabase();

    // Check if appointment exists
    const existingAppointment = await db.query(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );

    if (existingAppointment.rows.length === 0) {
      throw new CustomError('Appointment not found', 404);
    }

    const appointment = existingAppointment.rows[0];

    if (appointment.status === 'completed') {
      throw new CustomError('Cannot cancel completed appointment', 400);
    }

    if (appointment.status === 'cancelled') {
      throw new CustomError('Appointment is already cancelled', 400);
    }

    // Update appointment status to cancelled
    const updateQuery = `
      UPDATE appointments 
      SET status = $1, notes = COALESCE(notes, '') || $2, updated_at = $3
      WHERE id = $4
      RETURNING *
    `;

    const cancelReason = reason ? `\nCancellation reason: ${reason}` : '\nCancelled';
    const result = await db.query(updateQuery, [
      AppointmentStatus.CANCELLED,
      cancelReason,
      new Date(),
      id
    ]);

    const updatedAppointment = result.rows[0];

    // Update cache
    await setCache(`appointment:${id}`, updatedAppointment, 3600);

    logger.info('Appointment cancelled successfully', {
      appointmentId: id,
      cancelledBy: req.user?.id,
      reason
    });

    const response: APIResponse<Appointment> = {
      success: true,
      data: updatedAppointment,
      message: 'Appointment cancelled successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error cancelling appointment:', error);
    throw error;
  }
};

export const getDoctorSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { doctorId } = req.params;
  const { date } = req.query;

  try {
    const db = getDatabase();

    // Validate doctor exists
    const doctorCheck = await db.query(
      'SELECT id, first_name, last_name FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [doctorId, 'doctor']
    );

    if (doctorCheck.rows.length === 0) {
      throw new CustomError('Doctor not found', 404);
    }

    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const scheduleQuery = `
      SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.patient_number
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = $1 
      AND a.appointment_date >= $2 
      AND a.appointment_date <= $3
      AND a.status NOT IN ('cancelled')
      ORDER BY a.appointment_date ASC
    `;

    const result = await db.query(scheduleQuery, [doctorId, startOfDay, endOfDay]);

    const response: APIResponse = {
      success: true,
      data: {
        doctor: doctorCheck.rows[0],
        date: targetDate,
        appointments: result.rows
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching doctor schedule:', error);
    throw error;
  }
};

export const getAvailableSlots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { doctorId } = req.params;
  const { date, duration = 30 } = req.query;

  try {
    const db = getDatabase();

    // Validate doctor exists
    const doctorCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [doctorId, 'doctor']
    );

    if (doctorCheck.rows.length === 0) {
      throw new CustomError('Doctor not found', 404);
    }

    const targetDate = new Date(date as string);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(8, 0, 0, 0); // Start at 8 AM
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(18, 0, 0, 0); // End at 6 PM

    // Get existing appointments for the day
    const existingAppointments = await db.query(`
      SELECT appointment_date, duration 
      FROM appointments 
      WHERE doctor_id = $1 
      AND DATE(appointment_date) = DATE($2)
      AND status NOT IN ('cancelled')
      ORDER BY appointment_date ASC
    `, [doctorId, targetDate]);

    // Generate available slots
    const slotDuration = parseInt(duration as string);
    const availableSlots: string[] = [];
    
    let currentTime = new Date(startOfDay);
    
    while (currentTime < endOfDay) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
      
      // Check if this slot conflicts with any existing appointment
      const hasConflict = existingAppointments.rows.some(appointment => {
        const appointmentStart = new Date(appointment.appointment_date);
        const appointmentEnd = new Date(appointmentStart.getTime() + appointment.duration * 60000);
        
        return (currentTime < appointmentEnd && slotEnd > appointmentStart);
      });
      
      if (!hasConflict) {
        availableSlots.push(currentTime.toISOString());
      }
      
      // Move to next slot (15-minute intervals)
      currentTime = new Date(currentTime.getTime() + 15 * 60000);
    }

    const response: APIResponse = {
      success: true,
      data: {
        date: targetDate,
        duration: slotDuration,
        availableSlots
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching available slots:', error);
    throw error;
  }
};