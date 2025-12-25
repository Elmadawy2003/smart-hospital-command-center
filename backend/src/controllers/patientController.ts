import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { Patient, APIResponse, PaginatedResponse } from '@/types';

export const createPatient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    phone,
    email,
    address,
    emergencyContact,
    insuranceInfo,
    bloodType,
    allergies,
    medicalHistory
  } = req.body;

  try {
    const db = getDatabase();
    const patientId = uuidv4();
    
    // Generate unique patient number
    const patientNumberResult = await db.query(
      'SELECT COUNT(*) as count FROM patients'
    );
    const patientCount = parseInt(patientNumberResult.rows[0].count) + 1;
    const patientNumber = `P${new Date().getFullYear()}${patientCount.toString().padStart(6, '0')}`;

    // Check if email already exists
    if (email) {
      const existingPatient = await db.query(
        'SELECT id FROM patients WHERE email = $1',
        [email]
      );
      if (existingPatient.rows.length > 0) {
        throw new CustomError('Patient with this email already exists', 409);
      }
    }

    const insertQuery = `
      INSERT INTO patients (
        id, patient_number, first_name, last_name, date_of_birth, gender,
        phone, email, address, emergency_contact, insurance_info,
        blood_type, allergies, medical_history, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      patientId,
      patientNumber,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      JSON.stringify(emergencyContact),
      JSON.stringify(insuranceInfo),
      bloodType,
      JSON.stringify(allergies || []),
      JSON.stringify(medicalHistory || []),
      true,
      new Date(),
      new Date()
    ];

    const result = await db.query(insertQuery, values);
    const patient = result.rows[0];

    // Cache the patient data
    await setCache(`patient:${patientId}`, patient, 3600);

    logger.info('Patient created successfully', {
      patientId,
      patientNumber,
      createdBy: req.user?.id
    });

    const response: APIResponse<Patient> = {
      success: true,
      data: patient,
      message: 'Patient created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating patient:', error);
    throw error;
  }
};

export const getPatients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR patient_number ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND is_active = $${paramCount}`;
      queryParams.push(status === 'active');
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM patients ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get patients
    const patientsQuery = `
      SELECT 
        id, patient_number, first_name, last_name, date_of_birth, gender,
        phone, email, address, blood_type, is_active, created_at, updated_at
      FROM patients 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const patientsResult = await db.query(patientsQuery, queryParams);

    const response: PaginatedResponse<Patient> = {
      success: true,
      data: patientsResult.rows,
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
    logger.error('Error fetching patients:', error);
    throw error;
  }
};

export const getPatientById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Try to get from cache first
    const cachedPatient = await getCache<Patient>(`patient:${id}`);
    if (cachedPatient) {
      const response: APIResponse<Patient> = {
        success: true,
        data: cachedPatient,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();
    const query = `
      SELECT * FROM patients WHERE id = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new CustomError('Patient not found', 404);
    }

    const patient = result.rows[0];
    
    // Cache the patient data
    await setCache(`patient:${id}`, patient, 3600);

    const response: APIResponse<Patient> = {
      success: true,
      data: patient,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching patient:', error);
    throw error;
  }
};

export const updatePatient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { id } = req.params;
  const updateData = req.body;

  try {
    const db = getDatabase();

    // Check if patient exists
    const existingPatient = await db.query(
      'SELECT * FROM patients WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingPatient.rows.length === 0) {
      throw new CustomError('Patient not found', 404);
    }

    // Check if email is being updated and already exists
    if (updateData.email) {
      const emailCheck = await db.query(
        'SELECT id FROM patients WHERE email = $1 AND id != $2',
        [updateData.email, id]
      );
      if (emailCheck.rows.length > 0) {
        throw new CustomError('Patient with this email already exists', 409);
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
        
        if (typeof updateData[key] === 'object' && updateData[key] !== null) {
          values.push(JSON.stringify(updateData[key]));
        } else {
          values.push(updateData[key]);
        }
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
      UPDATE patients 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedPatient = result.rows[0];

    // Update cache
    await setCache(`patient:${id}`, updatedPatient, 3600);

    logger.info('Patient updated successfully', {
      patientId: id,
      updatedBy: req.user?.id,
      updatedFields: Object.keys(updateData)
    });

    const response: APIResponse<Patient> = {
      success: true,
      data: updatedPatient,
      message: 'Patient updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating patient:', error);
    throw error;
  }
};

export const deletePatient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const db = getDatabase();

    // Check if patient exists
    const existingPatient = await db.query(
      'SELECT * FROM patients WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingPatient.rows.length === 0) {
      throw new CustomError('Patient not found', 404);
    }

    // Soft delete - set is_active to false
    const updateQuery = `
      UPDATE patients 
      SET is_active = false, updated_at = $1
      WHERE id = $2
      RETURNING *
    `;

    await db.query(updateQuery, [new Date(), id]);

    // Remove from cache
    await deleteCache(`patient:${id}`);

    logger.info('Patient deleted successfully', {
      patientId: id,
      deletedBy: req.user?.id
    });

    const response: APIResponse = {
      success: true,
      message: 'Patient deleted successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error deleting patient:', error);
    throw error;
  }
};

export const getPatientMedicalHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const db = getDatabase();

    // Check if patient exists
    const patientCheck = await db.query(
      'SELECT id FROM patients WHERE id = $1 AND is_active = true',
      [id]
    );

    if (patientCheck.rows.length === 0) {
      throw new CustomError('Patient not found', 404);
    }

    // Get medical records
    const medicalRecordsQuery = `
      SELECT 
        mr.*,
        u.first_name as doctor_first_name,
        u.last_name as doctor_last_name
      FROM medical_records mr
      LEFT JOIN users u ON mr.doctor_id = u.id
      WHERE mr.patient_id = $1
      ORDER BY mr.visit_date DESC
    `;

    const medicalRecords = await db.query(medicalRecordsQuery, [id]);

    // Get appointments
    const appointmentsQuery = `
      SELECT 
        a.*,
        u.first_name as doctor_first_name,
        u.last_name as doctor_last_name
      FROM appointments a
      LEFT JOIN users u ON a.doctor_id = u.id
      WHERE a.patient_id = $1
      ORDER BY a.appointment_date DESC
      LIMIT 10
    `;

    const appointments = await db.query(appointmentsQuery, [id]);

    // Get lab results
    const labResultsQuery = `
      SELECT 
        lr.*,
        lo.ordered_at,
        lo.priority
      FROM lab_results lr
      LEFT JOIN lab_orders lo ON lr.lab_order_id = lo.id
      WHERE lo.patient_id = $1
      ORDER BY lr.performed_at DESC
      LIMIT 20
    `;

    const labResults = await db.query(labResultsQuery, [id]);

    const response: APIResponse = {
      success: true,
      data: {
        medicalRecords: medicalRecords.rows,
        recentAppointments: appointments.rows,
        recentLabResults: labResults.rows
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching patient medical history:', error);
    throw error;
  }
};

export const searchPatients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw new CustomError('Search query must be at least 2 characters long', 400);
  }

  try {
    const db = getDatabase();
    const searchTerm = `%${q.trim()}%`;

    const searchQuery = `
      SELECT 
        id, patient_number, first_name, last_name, date_of_birth, 
        gender, phone, email, blood_type
      FROM patients 
      WHERE is_active = true
      AND (
        first_name ILIKE $1 OR 
        last_name ILIKE $1 OR 
        patient_number ILIKE $1 OR 
        email ILIKE $1 OR
        phone ILIKE $1
      )
      ORDER BY 
        CASE 
          WHEN patient_number ILIKE $1 THEN 1
          WHEN first_name ILIKE $1 THEN 2
          WHEN last_name ILIKE $1 THEN 3
          ELSE 4
        END,
        first_name, last_name
      LIMIT 20
    `;

    const result = await db.query(searchQuery, [searchTerm]);

    const response: APIResponse<Patient[]> = {
      success: true,
      data: result.rows,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error searching patients:', error);
    throw error;
  }
};