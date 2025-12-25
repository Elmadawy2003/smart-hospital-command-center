import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { ImagingOrder, ImagingResult, APIResponse, PaginatedResponse } from '@/types';

export const createImagingOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const {
    patientId,
    doctorId,
    examType,
    bodyPart,
    priority,
    clinicalHistory,
    clinicalQuestion,
    contrastRequired,
    specialInstructions,
    appointmentId,
    scheduledDate
  } = req.body;

  try {
    const db = getDatabase();
    const orderId = uuidv4();

    // Verify patient exists
    const patientCheck = await db.query(
      'SELECT id, first_name, last_name FROM patients WHERE id = $1',
      [patientId]
    );
    if (patientCheck.rows.length === 0) {
      throw new CustomError('Patient not found', 404);
    }

    // Verify doctor exists
    const doctorCheck = await db.query(
      'SELECT id, first_name, last_name FROM users WHERE id = $1 AND role = $2',
      [doctorId, 'doctor']
    );
    if (doctorCheck.rows.length === 0) {
      throw new CustomError('Doctor not found', 404);
    }

    // Generate order number
    const orderNumber = `IMG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const insertQuery = `
      INSERT INTO imaging_orders (
        id, order_number, patient_id, doctor_id, exam_type, body_part, 
        priority, clinical_history, clinical_question, contrast_required, 
        special_instructions, appointment_id, scheduled_date, status, 
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      orderId,
      orderNumber,
      patientId,
      doctorId,
      examType,
      bodyPart,
      priority || 'normal',
      clinicalHistory,
      clinicalQuestion,
      contrastRequired || false,
      specialInstructions,
      appointmentId,
      scheduledDate ? new Date(scheduledDate) : null,
      'pending',
      req.user?.id,
      new Date(),
      new Date()
    ];

    const result = await db.query(insertQuery, values);
    const imagingOrder = result.rows[0];

    // Add patient and doctor details
    imagingOrder.patient = patientCheck.rows[0];
    imagingOrder.doctor = doctorCheck.rows[0];

    // Cache the imaging order
    await setCache(`imaging_order:${orderId}`, imagingOrder, 3600);

    // Clear imaging orders list cache
    await deleteCache('imaging_orders_list');

    logger.info('Imaging order created successfully', {
      orderId,
      orderNumber,
      patientId,
      doctorId,
      examType,
      createdBy: req.user?.id
    });

    const response: APIResponse<ImagingOrder> = {
      success: true,
      data: imagingOrder,
      message: 'Imaging order created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating imaging order:', error);
    throw error;
  }
};

export const getImagingOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const examType = req.query.examType as string;
    const patientId = req.query.patientId as string;
    const doctorId = req.query.doctorId as string;
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND io.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (priority) {
      paramCount++;
      whereClause += ` AND io.priority = $${paramCount}`;
      queryParams.push(priority);
    }

    if (examType) {
      paramCount++;
      whereClause += ` AND io.exam_type = $${paramCount}`;
      queryParams.push(examType);
    }

    if (patientId) {
      paramCount++;
      whereClause += ` AND io.patient_id = $${paramCount}`;
      queryParams.push(patientId);
    }

    if (doctorId) {
      paramCount++;
      whereClause += ` AND io.doctor_id = $${paramCount}`;
      queryParams.push(doctorId);
    }

    if (fromDate) {
      paramCount++;
      whereClause += ` AND io.created_at >= $${paramCount}`;
      queryParams.push(new Date(fromDate));
    }

    if (toDate) {
      paramCount++;
      whereClause += ` AND io.created_at <= $${paramCount}`;
      queryParams.push(new Date(toDate));
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (io.order_number ILIKE $${paramCount} OR p.first_name ILIKE $${paramCount} OR p.last_name ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM imaging_orders io
      LEFT JOIN patients p ON io.patient_id = p.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get imaging orders with patient and doctor details
    const ordersQuery = `
      SELECT 
        io.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.date_of_birth as patient_dob,
        p.gender as patient_gender,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization as doctor_specialization
      FROM imaging_orders io
      LEFT JOIN patients p ON io.patient_id = p.id
      LEFT JOIN users d ON io.doctor_id = d.id
      ${whereClause}
      ORDER BY io.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const ordersResult = await db.query(ordersQuery, queryParams);

    // Format the results
    const formattedOrders = ordersResult.rows.map(order => ({
      ...order,
      patient: {
        id: order.patient_id,
        firstName: order.patient_first_name,
        lastName: order.patient_last_name,
        dateOfBirth: order.patient_dob,
        gender: order.patient_gender
      },
      doctor: {
        id: order.doctor_id,
        firstName: order.doctor_first_name,
        lastName: order.doctor_last_name,
        specialization: order.doctor_specialization
      }
    }));

    const response: PaginatedResponse<ImagingOrder> = {
      success: true,
      data: formattedOrders,
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
    logger.error('Error fetching imaging orders:', error);
    throw error;
  }
};

export const getImagingOrderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Try to get from cache first
    const cachedOrder = await getCache<ImagingOrder>(`imaging_order:${id}`);
    if (cachedOrder) {
      const response: APIResponse<ImagingOrder> = {
        success: true,
        data: cachedOrder,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();
    const query = `
      SELECT 
        io.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.date_of_birth as patient_dob,
        p.gender as patient_gender,
        p.phone as patient_phone,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization as doctor_specialization
      FROM imaging_orders io
      LEFT JOIN patients p ON io.patient_id = p.id
      LEFT JOIN users d ON io.doctor_id = d.id
      WHERE io.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new CustomError('Imaging order not found', 404);
    }

    const order = result.rows[0];

    // Format the result
    const formattedOrder = {
      ...order,
      patient: {
        id: order.patient_id,
        firstName: order.patient_first_name,
        lastName: order.patient_last_name,
        dateOfBirth: order.patient_dob,
        gender: order.patient_gender,
        phone: order.patient_phone
      },
      doctor: {
        id: order.doctor_id,
        firstName: order.doctor_first_name,
        lastName: order.doctor_last_name,
        specialization: order.doctor_specialization
      }
    };

    // Get imaging results if any
    const resultsQuery = 'SELECT * FROM imaging_results WHERE order_id = $1 ORDER BY created_at DESC';
    const resultsResult = await db.query(resultsQuery, [id]);
    formattedOrder.results = resultsResult.rows.map(result => ({
      ...result,
      images: JSON.parse(result.images || '[]'),
      measurements: JSON.parse(result.measurements || '[]')
    }));
    
    // Cache the order
    await setCache(`imaging_order:${id}`, formattedOrder, 3600);

    const response: APIResponse<ImagingOrder> = {
      success: true,
      data: formattedOrder,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching imaging order:', error);
    throw error;
  }
};

export const updateImagingOrderStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { id } = req.params;
  const { status, notes, scheduledDate } = req.body;

  try {
    const db = getDatabase();

    // Check if order exists
    const existingOrder = await db.query(
      'SELECT * FROM imaging_orders WHERE id = $1',
      [id]
    );

    if (existingOrder.rows.length === 0) {
      throw new CustomError('Imaging order not found', 404);
    }

    const updateFields: string[] = ['status = $1', 'updated_at = $2'];
    const values: any[] = [status, new Date()];
    let paramCount = 2;

    if (notes !== undefined) {
      paramCount++;
      updateFields.push(`status_notes = $${paramCount}`);
      values.push(notes);
    }

    if (scheduledDate !== undefined) {
      paramCount++;
      updateFields.push(`scheduled_date = $${paramCount}`);
      values.push(scheduledDate ? new Date(scheduledDate) : null);
    }

    paramCount++;
    values.push(id);

    const updateQuery = `
      UPDATE imaging_orders 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedOrder = result.rows[0];

    // Update cache
    await setCache(`imaging_order:${id}`, updatedOrder, 3600);
    await deleteCache('imaging_orders_list');

    logger.info('Imaging order status updated successfully', {
      orderId: id,
      newStatus: status,
      updatedBy: req.user?.id
    });

    const response: APIResponse<ImagingOrder> = {
      success: true,
      data: updatedOrder,
      message: 'Imaging order status updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating imaging order status:', error);
    throw error;
  }
};

export const createImagingResult = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const {
    orderId,
    findings,
    impression,
    recommendations,
    images,
    measurements,
    radiologist,
    reviewedBy,
    technician,
    equipment,
    technique,
    contrast,
    complications
  } = req.body;

  try {
    const db = getDatabase();
    const resultId = uuidv4();

    // Verify imaging order exists
    const orderCheck = await db.query(
      'SELECT * FROM imaging_orders WHERE id = $1',
      [orderId]
    );
    if (orderCheck.rows.length === 0) {
      throw new CustomError('Imaging order not found', 404);
    }

    const insertQuery = `
      INSERT INTO imaging_results (
        id, order_id, findings, impression, recommendations, images, 
        measurements, radiologist, reviewed_by, technician, equipment, 
        technique, contrast, complications, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      resultId,
      orderId,
      findings,
      impression,
      recommendations,
      JSON.stringify(images || []),
      JSON.stringify(measurements || []),
      radiologist,
      reviewedBy,
      technician,
      equipment,
      technique,
      contrast,
      complications,
      'pending_review',
      req.user?.id,
      new Date(),
      new Date()
    ];

    const result = await db.query(insertQuery, values);
    const imagingResult = result.rows[0];

    // Parse JSON fields
    imagingResult.images = JSON.parse(imagingResult.images || '[]');
    imagingResult.measurements = JSON.parse(imagingResult.measurements || '[]');

    // Update order status to completed
    await db.query(
      'UPDATE imaging_orders SET status = $1, updated_at = $2 WHERE id = $3',
      ['completed', new Date(), orderId]
    );

    // Clear caches
    await deleteCache(`imaging_order:${orderId}`);
    await deleteCache('imaging_orders_list');

    logger.info('Imaging result created successfully', {
      resultId,
      orderId,
      radiologist,
      createdBy: req.user?.id
    });

    const response: APIResponse<ImagingResult> = {
      success: true,
      data: imagingResult,
      message: 'Imaging result created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating imaging result:', error);
    throw error;
  }
};

export const getImagingResults = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const orderId = req.query.orderId as string;
    const patientId = req.query.patientId as string;
    const examType = req.query.examType as string;
    const radiologist = req.query.radiologist as string;
    const status = req.query.status as string;
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (orderId) {
      paramCount++;
      whereClause += ` AND ir.order_id = $${paramCount}`;
      queryParams.push(orderId);
    }

    if (patientId) {
      paramCount++;
      whereClause += ` AND io.patient_id = $${paramCount}`;
      queryParams.push(patientId);
    }

    if (examType) {
      paramCount++;
      whereClause += ` AND io.exam_type = $${paramCount}`;
      queryParams.push(examType);
    }

    if (radiologist) {
      paramCount++;
      whereClause += ` AND ir.radiologist ILIKE $${paramCount}`;
      queryParams.push(`%${radiologist}%`);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND ir.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (fromDate) {
      paramCount++;
      whereClause += ` AND ir.created_at >= $${paramCount}`;
      queryParams.push(new Date(fromDate));
    }

    if (toDate) {
      paramCount++;
      whereClause += ` AND ir.created_at <= $${paramCount}`;
      queryParams.push(new Date(toDate));
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM imaging_results ir
      LEFT JOIN imaging_orders io ON ir.order_id = io.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get imaging results with order and patient details
    const resultsQuery = `
      SELECT 
        ir.*,
        io.order_number,
        io.exam_type,
        io.body_part,
        io.patient_id,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name
      FROM imaging_results ir
      LEFT JOIN imaging_orders io ON ir.order_id = io.id
      LEFT JOIN patients p ON io.patient_id = p.id
      ${whereClause}
      ORDER BY ir.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const resultsResult = await db.query(resultsQuery, queryParams);

    // Format the results
    const formattedResults = resultsResult.rows.map(result => ({
      ...result,
      images: JSON.parse(result.images || '[]'),
      measurements: JSON.parse(result.measurements || '[]'),
      patient: {
        id: result.patient_id,
        firstName: result.patient_first_name,
        lastName: result.patient_last_name
      },
      order: {
        orderNumber: result.order_number,
        examType: result.exam_type,
        bodyPart: result.body_part
      }
    }));

    const response: PaginatedResponse<ImagingResult> = {
      success: true,
      data: formattedResults,
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
    logger.error('Error fetching imaging results:', error);
    throw error;
  }
};

export const updateImagingResult = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { id } = req.params;
  const updateData = req.body;

  try {
    const db = getDatabase();

    // Check if result exists
    const existingResult = await db.query(
      'SELECT * FROM imaging_results WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw new CustomError('Imaging result not found', 404);
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id') {
        paramCount++;
        
        if (['images', 'measurements'].includes(key)) {
          updateFields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updateData[key]));
        } else {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updateFields.push(`${dbKey} = $${paramCount}`);
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
      UPDATE imaging_results 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedResult = result.rows[0];

    // Parse JSON fields
    updatedResult.images = JSON.parse(updatedResult.images || '[]');
    updatedResult.measurements = JSON.parse(updatedResult.measurements || '[]');

    // Clear caches
    await deleteCache(`imaging_order:${updatedResult.order_id}`);

    logger.info('Imaging result updated successfully', {
      resultId: id,
      updatedBy: req.user?.id,
      updatedFields: Object.keys(updateData)
    });

    const response: APIResponse<ImagingResult> = {
      success: true,
      data: updatedResult,
      message: 'Imaging result updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating imaging result:', error);
    throw error;
  }
};

export const getImagingStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    // Get imaging statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT io.id) as total_orders,
        COUNT(CASE WHEN io.status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN io.status = 'scheduled' THEN 1 END) as scheduled_orders,
        COUNT(CASE WHEN io.status = 'in_progress' THEN 1 END) as in_progress_orders,
        COUNT(CASE WHEN io.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(DISTINCT ir.id) as total_results,
        COUNT(CASE WHEN ir.status = 'pending_review' THEN 1 END) as pending_results,
        COUNT(CASE WHEN ir.status = 'reviewed' THEN 1 END) as reviewed_results
      FROM imaging_orders io
      LEFT JOIN imaging_results ir ON io.id = ir.order_id
      WHERE io.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const statsResult = await db.query(statsQuery);
    const stats = statsResult.rows[0];

    // Get exam type frequency
    const examFrequencyQuery = `
      SELECT 
        exam_type,
        COUNT(*) as frequency
      FROM imaging_orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY exam_type
      ORDER BY frequency DESC
      LIMIT 10
    `;

    const examFrequencyResult = await db.query(examFrequencyQuery);

    // Get daily order trends
    const trendsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders_count
      FROM imaging_orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const trendsResult = await db.query(trendsQuery);

    // Get equipment utilization
    const equipmentQuery = `
      SELECT 
        equipment,
        COUNT(*) as usage_count
      FROM imaging_results
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND equipment IS NOT NULL
      GROUP BY equipment
      ORDER BY usage_count DESC
    `;

    const equipmentResult = await db.query(equipmentQuery);

    const response: APIResponse = {
      success: true,
      data: {
        overview: {
          totalOrders: parseInt(stats.total_orders),
          pendingOrders: parseInt(stats.pending_orders),
          scheduledOrders: parseInt(stats.scheduled_orders),
          inProgressOrders: parseInt(stats.in_progress_orders),
          completedOrders: parseInt(stats.completed_orders),
          totalResults: parseInt(stats.total_results),
          pendingResults: parseInt(stats.pending_results),
          reviewedResults: parseInt(stats.reviewed_results)
        },
        examFrequency: examFrequencyResult.rows,
        dailyTrends: trendsResult.rows,
        equipmentUtilization: equipmentResult.rows
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching imaging stats:', error);
    throw error;
  }
};