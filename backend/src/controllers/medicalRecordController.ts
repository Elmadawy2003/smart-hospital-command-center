import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { MedicalRecord, APIResponse, PaginatedResponse } from '@/types';

export const createMedicalRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const {
    patientId,
    diagnosis,
    symptoms,
    treatment,
    medications,
    notes,
    visitDate,
    followUpDate,
    vitalSigns,
    allergies,
    labResults,
    imagingResults
  } = req.body;

  try {
    const db = getDatabase();
    const recordId = uuidv4();
    const doctorId = req.user?.id;

    // Validate patient exists
    const patientCheck = await db.query(
      'SELECT id FROM patients WHERE id = $1 AND is_active = true',
      [patientId]
    );
    if (patientCheck.rows.length === 0) {
      throw new CustomError('Patient not found', 404);
    }

    // Validate doctor exists and has permission
    if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
      throw new CustomError('Only doctors can create medical records', 403);
    }

    const insertQuery = `
      INSERT INTO medical_records (
        id, patient_id, doctor_id, diagnosis, symptoms, treatment, 
        medications, notes, visit_date, follow_up_date, vital_signs,
        allergies, lab_results, imaging_results, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      recordId,
      patientId,
      doctorId,
      diagnosis,
      symptoms,
      treatment,
      medications ? JSON.stringify(medications) : null,
      notes,
      visitDate ? new Date(visitDate) : new Date(),
      followUpDate ? new Date(followUpDate) : null,
      vitalSigns ? JSON.stringify(vitalSigns) : null,
      allergies ? JSON.stringify(allergies) : null,
      labResults ? JSON.stringify(labResults) : null,
      imagingResults ? JSON.stringify(imagingResults) : null,
      new Date(),
      new Date()
    ];

    const result = await db.query(insertQuery, values);
    const medicalRecord = result.rows[0];

    // Parse JSON fields for response
    if (medicalRecord.medications) {
      medicalRecord.medications = JSON.parse(medicalRecord.medications);
    }
    if (medicalRecord.vital_signs) {
      medicalRecord.vitalSigns = JSON.parse(medicalRecord.vital_signs);
    }
    if (medicalRecord.allergies) {
      medicalRecord.allergies = JSON.parse(medicalRecord.allergies);
    }
    if (medicalRecord.lab_results) {
      medicalRecord.labResults = JSON.parse(medicalRecord.lab_results);
    }
    if (medicalRecord.imaging_results) {
      medicalRecord.imagingResults = JSON.parse(medicalRecord.imaging_results);
    }

    // Cache the medical record
    await setCache(`medical_record:${recordId}`, medicalRecord, 3600);

    // Clear patient medical history cache
    await deleteCache(`patient_medical_history:${patientId}`);

    logger.info('Medical record created successfully', {
      recordId,
      patientId,
      doctorId,
      diagnosis
    });

    const response: APIResponse<MedicalRecord> = {
      success: true,
      data: medicalRecord,
      message: 'Medical record created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating medical record:', error);
    throw error;
  }
};

export const getMedicalRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const patientId = req.query.patientId as string;
    const doctorId = req.query.doctorId as string;
    const diagnosis = req.query.diagnosis as string;
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (patientId) {
      paramCount++;
      whereClause += ` AND mr.patient_id = $${paramCount}`;
      queryParams.push(patientId);
    }

    if (doctorId) {
      paramCount++;
      whereClause += ` AND mr.doctor_id = $${paramCount}`;
      queryParams.push(doctorId);
    }

    if (diagnosis) {
      paramCount++;
      whereClause += ` AND mr.diagnosis ILIKE $${paramCount}`;
      queryParams.push(`%${diagnosis}%`);
    }

    if (fromDate) {
      paramCount++;
      whereClause += ` AND mr.visit_date >= $${paramCount}`;
      queryParams.push(new Date(fromDate));
    }

    if (toDate) {
      paramCount++;
      whereClause += ` AND mr.visit_date <= $${paramCount}`;
      queryParams.push(new Date(toDate));
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM medical_records mr 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get medical records with patient and doctor details
    const recordsQuery = `
      SELECT 
        mr.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.patient_number,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        dept.name as department_name
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN users d ON mr.doctor_id = d.id
      LEFT JOIN departments dept ON d.department = dept.id
      ${whereClause}
      ORDER BY mr.visit_date DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const recordsResult = await db.query(recordsQuery, queryParams);

    // Parse JSON fields
    const records = recordsResult.rows.map(record => {
      if (record.medications) {
        record.medications = JSON.parse(record.medications);
      }
      if (record.vital_signs) {
        record.vitalSigns = JSON.parse(record.vital_signs);
      }
      if (record.allergies) {
        record.allergies = JSON.parse(record.allergies);
      }
      if (record.lab_results) {
        record.labResults = JSON.parse(record.lab_results);
      }
      if (record.imaging_results) {
        record.imagingResults = JSON.parse(record.imaging_results);
      }
      return record;
    });

    const response: PaginatedResponse<MedicalRecord> = {
      success: true,
      data: records,
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
    logger.error('Error fetching medical records:', error);
    throw error;
  }
};

export const getMedicalRecordById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Try to get from cache first
    const cachedRecord = await getCache<MedicalRecord>(`medical_record:${id}`);
    if (cachedRecord) {
      const response: APIResponse<MedicalRecord> = {
        success: true,
        data: cachedRecord,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();
    const query = `
      SELECT 
        mr.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        p.blood_type,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        dept.name as department_name
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN users d ON mr.doctor_id = d.id
      LEFT JOIN departments dept ON d.department = dept.id
      WHERE mr.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new CustomError('Medical record not found', 404);
    }

    const record = result.rows[0];

    // Parse JSON fields
    if (record.medications) {
      record.medications = JSON.parse(record.medications);
    }
    if (record.vital_signs) {
      record.vitalSigns = JSON.parse(record.vital_signs);
    }
    if (record.allergies) {
      record.allergies = JSON.parse(record.allergies);
    }
    if (record.lab_results) {
      record.labResults = JSON.parse(record.lab_results);
    }
    if (record.imaging_results) {
      record.imagingResults = JSON.parse(record.imaging_results);
    }
    
    // Cache the record
    await setCache(`medical_record:${id}`, record, 3600);

    const response: APIResponse<MedicalRecord> = {
      success: true,
      data: record,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching medical record:', error);
    throw error;
  }
};

export const updateMedicalRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { id } = req.params;
  const updateData = req.body;

  try {
    const db = getDatabase();

    // Check if record exists
    const existingRecord = await db.query(
      'SELECT * FROM medical_records WHERE id = $1',
      [id]
    );

    if (existingRecord.rows.length === 0) {
      throw new CustomError('Medical record not found', 404);
    }

    const currentRecord = existingRecord.rows[0];

    // Check permissions - only the doctor who created the record or admin can update
    if (req.user?.role !== 'admin' && req.user?.id !== currentRecord.doctor_id) {
      throw new CustomError('You can only update your own medical records', 403);
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id') {
        paramCount++;
        
        // Handle JSON fields
        if (['medications', 'vitalSigns', 'allergies', 'labResults', 'imagingResults'].includes(key)) {
          updateFields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramCount}`);
          values.push(JSON.stringify(updateData[key]));
        } else if (['visitDate', 'followUpDate'].includes(key)) {
          updateFields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramCount}`);
          values.push(updateData[key] ? new Date(updateData[key]) : null);
        } else {
          updateFields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramCount}`);
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
      UPDATE medical_records 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedRecord = result.rows[0];

    // Parse JSON fields for response
    if (updatedRecord.medications) {
      updatedRecord.medications = JSON.parse(updatedRecord.medications);
    }
    if (updatedRecord.vital_signs) {
      updatedRecord.vitalSigns = JSON.parse(updatedRecord.vital_signs);
    }
    if (updatedRecord.allergies) {
      updatedRecord.allergies = JSON.parse(updatedRecord.allergies);
    }
    if (updatedRecord.lab_results) {
      updatedRecord.labResults = JSON.parse(updatedRecord.lab_results);
    }
    if (updatedRecord.imaging_results) {
      updatedRecord.imagingResults = JSON.parse(updatedRecord.imaging_results);
    }

    // Update cache
    await setCache(`medical_record:${id}`, updatedRecord, 3600);

    // Clear patient medical history cache
    await deleteCache(`patient_medical_history:${currentRecord.patient_id}`);

    logger.info('Medical record updated successfully', {
      recordId: id,
      updatedBy: req.user?.id,
      updatedFields: Object.keys(updateData)
    });

    const response: APIResponse<MedicalRecord> = {
      success: true,
      data: updatedRecord,
      message: 'Medical record updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating medical record:', error);
    throw error;
  }
};

export const deleteMedicalRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const db = getDatabase();

    // Check if record exists
    const existingRecord = await db.query(
      'SELECT * FROM medical_records WHERE id = $1',
      [id]
    );

    if (existingRecord.rows.length === 0) {
      throw new CustomError('Medical record not found', 404);
    }

    const record = existingRecord.rows[0];

    // Check permissions - only admin can delete medical records
    if (req.user?.role !== 'admin') {
      throw new CustomError('Only administrators can delete medical records', 403);
    }

    // Soft delete - mark as deleted instead of actually deleting
    await db.query(
      'UPDATE medical_records SET is_deleted = true, updated_at = $1 WHERE id = $2',
      [new Date(), id]
    );

    // Remove from cache
    await deleteCache(`medical_record:${id}`);
    await deleteCache(`patient_medical_history:${record.patient_id}`);

    logger.info('Medical record deleted successfully', {
      recordId: id,
      deletedBy: req.user?.id
    });

    const response: APIResponse = {
      success: true,
      message: 'Medical record deleted successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error deleting medical record:', error);
    throw error;
  }
};

export const getPatientMedicalHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { patientId } = req.params;
  const { limit = 50 } = req.query;

  try {
    // Try to get from cache first
    const cacheKey = `patient_medical_history:${patientId}`;
    const cachedHistory = await getCache(cacheKey);
    if (cachedHistory) {
      const response: APIResponse = {
        success: true,
        data: cachedHistory,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();

    // Validate patient exists
    const patientCheck = await db.query(
      'SELECT id, first_name, last_name, patient_number FROM patients WHERE id = $1 AND is_active = true',
      [patientId]
    );

    if (patientCheck.rows.length === 0) {
      throw new CustomError('Patient not found', 404);
    }

    const patient = patientCheck.rows[0];

    // Get medical records
    const recordsQuery = `
      SELECT 
        mr.*,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        dept.name as department_name
      FROM medical_records mr
      LEFT JOIN users d ON mr.doctor_id = d.id
      LEFT JOIN departments dept ON d.department = dept.id
      WHERE mr.patient_id = $1 AND (mr.is_deleted IS NULL OR mr.is_deleted = false)
      ORDER BY mr.visit_date DESC
      LIMIT $2
    `;

    const recordsResult = await db.query(recordsQuery, [patientId, limit]);

    // Parse JSON fields
    const records = recordsResult.rows.map(record => {
      if (record.medications) {
        record.medications = JSON.parse(record.medications);
      }
      if (record.vital_signs) {
        record.vitalSigns = JSON.parse(record.vital_signs);
      }
      if (record.allergies) {
        record.allergies = JSON.parse(record.allergies);
      }
      if (record.lab_results) {
        record.labResults = JSON.parse(record.lab_results);
      }
      if (record.imaging_results) {
        record.imagingResults = JSON.parse(record.imaging_results);
      }
      return record;
    });

    const medicalHistory = {
      patient,
      records,
      totalRecords: records.length
    };

    // Cache the medical history
    await setCache(cacheKey, medicalHistory, 1800); // 30 minutes

    const response: APIResponse = {
      success: true,
      data: medicalHistory,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching patient medical history:', error);
    throw error;
  }
};

export const searchMedicalRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { query, type = 'all' } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  if (!query) {
    throw new CustomError('Search query is required', 400);
  }

  try {
    const db = getDatabase();
    let searchQuery = '';
    let countQuery = '';
    const searchTerm = `%${query}%`;

    switch (type) {
      case 'diagnosis':
        searchQuery = `
          SELECT mr.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
                 d.first_name as doctor_first_name, d.last_name as doctor_last_name
          FROM medical_records mr
          LEFT JOIN patients p ON mr.patient_id = p.id
          LEFT JOIN users d ON mr.doctor_id = d.id
          WHERE mr.diagnosis ILIKE $1 AND (mr.is_deleted IS NULL OR mr.is_deleted = false)
          ORDER BY mr.visit_date DESC
          LIMIT $2 OFFSET $3
        `;
        countQuery = `
          SELECT COUNT(*) as total FROM medical_records mr
          WHERE mr.diagnosis ILIKE $1 AND (mr.is_deleted IS NULL OR mr.is_deleted = false)
        `;
        break;
      case 'symptoms':
        searchQuery = `
          SELECT mr.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
                 d.first_name as doctor_first_name, d.last_name as doctor_last_name
          FROM medical_records mr
          LEFT JOIN patients p ON mr.patient_id = p.id
          LEFT JOIN users d ON mr.doctor_id = d.id
          WHERE mr.symptoms ILIKE $1 AND (mr.is_deleted IS NULL OR mr.is_deleted = false)
          ORDER BY mr.visit_date DESC
          LIMIT $2 OFFSET $3
        `;
        countQuery = `
          SELECT COUNT(*) as total FROM medical_records mr
          WHERE mr.symptoms ILIKE $1 AND (mr.is_deleted IS NULL OR mr.is_deleted = false)
        `;
        break;
      default:
        searchQuery = `
          SELECT mr.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
                 d.first_name as doctor_first_name, d.last_name as doctor_last_name
          FROM medical_records mr
          LEFT JOIN patients p ON mr.patient_id = p.id
          LEFT JOIN users d ON mr.doctor_id = d.id
          WHERE (mr.diagnosis ILIKE $1 OR mr.symptoms ILIKE $1 OR mr.treatment ILIKE $1 OR mr.notes ILIKE $1)
          AND (mr.is_deleted IS NULL OR mr.is_deleted = false)
          ORDER BY mr.visit_date DESC
          LIMIT $2 OFFSET $3
        `;
        countQuery = `
          SELECT COUNT(*) as total FROM medical_records mr
          WHERE (mr.diagnosis ILIKE $1 OR mr.symptoms ILIKE $1 OR mr.treatment ILIKE $1 OR mr.notes ILIKE $1)
          AND (mr.is_deleted IS NULL OR mr.is_deleted = false)
        `;
    }

    const [searchResult, countResult] = await Promise.all([
      db.query(searchQuery, [searchTerm, limit, offset]),
      db.query(countQuery, [searchTerm])
    ]);

    const total = parseInt(countResult.rows[0].total);

    // Parse JSON fields
    const records = searchResult.rows.map(record => {
      if (record.medications) {
        record.medications = JSON.parse(record.medications);
      }
      if (record.vital_signs) {
        record.vitalSigns = JSON.parse(record.vital_signs);
      }
      if (record.allergies) {
        record.allergies = JSON.parse(record.allergies);
      }
      if (record.lab_results) {
        record.labResults = JSON.parse(record.lab_results);
      }
      if (record.imaging_results) {
        record.imagingResults = JSON.parse(record.imaging_results);
      }
      return record;
    });

    const response: PaginatedResponse<MedicalRecord> = {
      success: true,
      data: records,
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
    logger.error('Error searching medical records:', error);
    throw error;
  }
};