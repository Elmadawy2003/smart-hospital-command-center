import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { LabOrder, LabResult, APIResponse, PaginatedResponse } from '@/types';

export const createLabOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const {
    patientId,
    doctorId,
    tests,
    priority,
    clinicalNotes,
    fastingRequired,
    specialInstructions,
    appointmentId
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
    const orderNumber = `LAB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const insertQuery = `
      INSERT INTO lab_orders (
        id, order_number, patient_id, doctor_id, tests, priority, 
        clinical_notes, fasting_required, special_instructions, 
        appointment_id, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      orderId,
      orderNumber,
      patientId,
      doctorId,
      JSON.stringify(tests),
      priority || 'normal',
      clinicalNotes,
      fastingRequired || false,
      specialInstructions,
      appointmentId,
      'pending',
      req.user?.id,
      new Date(),
      new Date()
    ];

    const result = await db.query(insertQuery, values);
    const labOrder = result.rows[0];

    // Parse tests back to array
    labOrder.tests = JSON.parse(labOrder.tests);

    // Add patient and doctor details
    labOrder.patient = patientCheck.rows[0];
    labOrder.doctor = doctorCheck.rows[0];

    // Cache the lab order
    await setCache(`lab_order:${orderId}`, labOrder, 3600);

    // Clear lab orders list cache
    await deleteCache('lab_orders_list');

    logger.info('Lab order created successfully', {
      orderId,
      orderNumber,
      patientId,
      doctorId,
      testsCount: tests.length,
      createdBy: req.user?.id
    });

    const response: APIResponse<LabOrder> = {
      success: true,
      data: labOrder,
      message: 'Lab order created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating lab order:', error);
    throw error;
  }
};

export const getLabOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
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
      whereClause += ` AND lo.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (priority) {
      paramCount++;
      whereClause += ` AND lo.priority = $${paramCount}`;
      queryParams.push(priority);
    }

    if (patientId) {
      paramCount++;
      whereClause += ` AND lo.patient_id = $${paramCount}`;
      queryParams.push(patientId);
    }

    if (doctorId) {
      paramCount++;
      whereClause += ` AND lo.doctor_id = $${paramCount}`;
      queryParams.push(doctorId);
    }

    if (fromDate) {
      paramCount++;
      whereClause += ` AND lo.created_at >= $${paramCount}`;
      queryParams.push(new Date(fromDate));
    }

    if (toDate) {
      paramCount++;
      whereClause += ` AND lo.created_at <= $${paramCount}`;
      queryParams.push(new Date(toDate));
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (lo.order_number ILIKE $${paramCount} OR p.first_name ILIKE $${paramCount} OR p.last_name ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM lab_orders lo
      LEFT JOIN patients p ON lo.patient_id = p.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get lab orders with patient and doctor details
    const ordersQuery = `
      SELECT 
        lo.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.date_of_birth as patient_dob,
        p.gender as patient_gender,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization as doctor_specialization
      FROM lab_orders lo
      LEFT JOIN patients p ON lo.patient_id = p.id
      LEFT JOIN users d ON lo.doctor_id = d.id
      ${whereClause}
      ORDER BY lo.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const ordersResult = await db.query(ordersQuery, queryParams);

    // Format the results
    const formattedOrders = ordersResult.rows.map(order => ({
      ...order,
      tests: JSON.parse(order.tests || '[]'),
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

    const response: PaginatedResponse<LabOrder> = {
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
    logger.error('Error fetching lab orders:', error);
    throw error;
  }
};

export const getLabOrderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Try to get from cache first
    const cachedOrder = await getCache<LabOrder>(`lab_order:${id}`);
    if (cachedOrder) {
      const response: APIResponse<LabOrder> = {
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
        lo.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.date_of_birth as patient_dob,
        p.gender as patient_gender,
        p.phone as patient_phone,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization as doctor_specialization
      FROM lab_orders lo
      LEFT JOIN patients p ON lo.patient_id = p.id
      LEFT JOIN users d ON lo.doctor_id = d.id
      WHERE lo.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new CustomError('Lab order not found', 404);
    }

    const order = result.rows[0];

    // Format the result
    const formattedOrder = {
      ...order,
      tests: JSON.parse(order.tests || '[]'),
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

    // Get lab results if any
    const resultsQuery = 'SELECT * FROM lab_results WHERE order_id = $1 ORDER BY created_at DESC';
    const resultsResult = await db.query(resultsQuery, [id]);
    formattedOrder.results = resultsResult.rows.map(result => ({
      ...result,
      values: JSON.parse(result.values || '[]')
    }));
    
    // Cache the order
    await setCache(`lab_order:${id}`, formattedOrder, 3600);

    const response: APIResponse<LabOrder> = {
      success: true,
      data: formattedOrder,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching lab order:', error);
    throw error;
  }
};

export const updateLabOrderStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    const db = getDatabase();

    // Check if order exists
    const existingOrder = await db.query(
      'SELECT * FROM lab_orders WHERE id = $1',
      [id]
    );

    if (existingOrder.rows.length === 0) {
      throw new CustomError('Lab order not found', 404);
    }

    const updateQuery = `
      UPDATE lab_orders 
      SET status = $1, status_notes = $2, updated_at = $3
      WHERE id = $4
      RETURNING *
    `;

    const result = await db.query(updateQuery, [status, notes, new Date(), id]);
    const updatedOrder = result.rows[0];

    // Parse tests
    updatedOrder.tests = JSON.parse(updatedOrder.tests || '[]');

    // Update cache
    await setCache(`lab_order:${id}`, updatedOrder, 3600);
    await deleteCache('lab_orders_list');

    logger.info('Lab order status updated successfully', {
      orderId: id,
      newStatus: status,
      updatedBy: req.user?.id
    });

    const response: APIResponse<LabOrder> = {
      success: true,
      data: updatedOrder,
      message: 'Lab order status updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating lab order status:', error);
    throw error;
  }
};

export const createLabResult = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const {
    orderId,
    testName,
    values,
    referenceRanges,
    abnormalFlags,
    technician,
    reviewedBy,
    comments,
    attachments
  } = req.body;

  try {
    const db = getDatabase();
    const resultId = uuidv4();

    // Verify lab order exists
    const orderCheck = await db.query(
      'SELECT * FROM lab_orders WHERE id = $1',
      [orderId]
    );
    if (orderCheck.rows.length === 0) {
      throw new CustomError('Lab order not found', 404);
    }

    const insertQuery = `
      INSERT INTO lab_results (
        id, order_id, test_name, values, reference_ranges, 
        abnormal_flags, technician, reviewed_by, comments, 
        attachments, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const resultValues = [
      resultId,
      orderId,
      testName,
      JSON.stringify(values),
      JSON.stringify(referenceRanges || {}),
      JSON.stringify(abnormalFlags || []),
      technician,
      reviewedBy,
      comments,
      JSON.stringify(attachments || []),
      'pending_review',
      req.user?.id,
      new Date(),
      new Date()
    ];

    const result = await db.query(insertQuery, resultValues);
    const labResult = result.rows[0];

    // Parse JSON fields
    labResult.values = JSON.parse(labResult.values);
    labResult.referenceRanges = JSON.parse(labResult.reference_ranges || '{}');
    labResult.abnormalFlags = JSON.parse(labResult.abnormal_flags || '[]');
    labResult.attachments = JSON.parse(labResult.attachments || '[]');

    // Check if all tests for the order are completed
    const orderTests = JSON.parse(orderCheck.rows[0].tests || '[]');
    const completedResults = await db.query(
      'SELECT DISTINCT test_name FROM lab_results WHERE order_id = $1',
      [orderId]
    );
    
    const completedTestNames = completedResults.rows.map(r => r.test_name);
    const allTestsCompleted = orderTests.every((test: any) => 
      completedTestNames.includes(test.name || test)
    );

    // Update order status if all tests are completed
    if (allTestsCompleted) {
      await db.query(
        'UPDATE lab_orders SET status = $1, updated_at = $2 WHERE id = $3',
        ['completed', new Date(), orderId]
      );
    }

    // Clear caches
    await deleteCache(`lab_order:${orderId}`);
    await deleteCache('lab_orders_list');

    logger.info('Lab result created successfully', {
      resultId,
      orderId,
      testName,
      createdBy: req.user?.id
    });

    const response: APIResponse<LabResult> = {
      success: true,
      data: labResult,
      message: 'Lab result created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating lab result:', error);
    throw error;
  }
};

export const getLabResults = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const orderId = req.query.orderId as string;
    const patientId = req.query.patientId as string;
    const testName = req.query.testName as string;
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
      whereClause += ` AND lr.order_id = $${paramCount}`;
      queryParams.push(orderId);
    }

    if (patientId) {
      paramCount++;
      whereClause += ` AND lo.patient_id = $${paramCount}`;
      queryParams.push(patientId);
    }

    if (testName) {
      paramCount++;
      whereClause += ` AND lr.test_name ILIKE $${paramCount}`;
      queryParams.push(`%${testName}%`);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND lr.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (fromDate) {
      paramCount++;
      whereClause += ` AND lr.created_at >= $${paramCount}`;
      queryParams.push(new Date(fromDate));
    }

    if (toDate) {
      paramCount++;
      whereClause += ` AND lr.created_at <= $${paramCount}`;
      queryParams.push(new Date(toDate));
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM lab_results lr
      LEFT JOIN lab_orders lo ON lr.order_id = lo.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get lab results with order and patient details
    const resultsQuery = `
      SELECT 
        lr.*,
        lo.order_number,
        lo.patient_id,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name
      FROM lab_results lr
      LEFT JOIN lab_orders lo ON lr.order_id = lo.id
      LEFT JOIN patients p ON lo.patient_id = p.id
      ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const resultsResult = await db.query(resultsQuery, queryParams);

    // Format the results
    const formattedResults = resultsResult.rows.map(result => ({
      ...result,
      values: JSON.parse(result.values || '[]'),
      referenceRanges: JSON.parse(result.reference_ranges || '{}'),
      abnormalFlags: JSON.parse(result.abnormal_flags || '[]'),
      attachments: JSON.parse(result.attachments || '[]'),
      patient: {
        id: result.patient_id,
        firstName: result.patient_first_name,
        lastName: result.patient_last_name
      }
    }));

    const response: PaginatedResponse<LabResult> = {
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
    logger.error('Error fetching lab results:', error);
    throw error;
  }
};

export const updateLabResult = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      'SELECT * FROM lab_results WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw new CustomError('Lab result not found', 404);
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id') {
        paramCount++;
        
        if (['values', 'referenceRanges', 'abnormalFlags', 'attachments'].includes(key)) {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updateFields.push(`${dbKey} = $${paramCount}`);
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
      UPDATE lab_results 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedResult = result.rows[0];

    // Parse JSON fields
    updatedResult.values = JSON.parse(updatedResult.values || '[]');
    updatedResult.referenceRanges = JSON.parse(updatedResult.reference_ranges || '{}');
    updatedResult.abnormalFlags = JSON.parse(updatedResult.abnormal_flags || '[]');
    updatedResult.attachments = JSON.parse(updatedResult.attachments || '[]');

    // Clear caches
    await deleteCache(`lab_order:${updatedResult.order_id}`);

    logger.info('Lab result updated successfully', {
      resultId: id,
      updatedBy: req.user?.id,
      updatedFields: Object.keys(updateData)
    });

    const response: APIResponse<LabResult> = {
      success: true,
      data: updatedResult,
      message: 'Lab result updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating lab result:', error);
    throw error;
  }
};

export const getLabStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    // Get lab statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT lo.id) as total_orders,
        COUNT(CASE WHEN lo.status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN lo.status = 'in_progress' THEN 1 END) as in_progress_orders,
        COUNT(CASE WHEN lo.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(DISTINCT lr.id) as total_results,
        COUNT(CASE WHEN lr.status = 'pending_review' THEN 1 END) as pending_results,
        COUNT(CASE WHEN lr.status = 'reviewed' THEN 1 END) as reviewed_results
      FROM lab_orders lo
      LEFT JOIN lab_results lr ON lo.id = lr.order_id
      WHERE lo.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const statsResult = await db.query(statsQuery);
    const stats = statsResult.rows[0];

    // Get test frequency
    const testFrequencyQuery = `
      SELECT 
        test_name,
        COUNT(*) as frequency
      FROM lab_results
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY test_name
      ORDER BY frequency DESC
      LIMIT 10
    `;

    const testFrequencyResult = await db.query(testFrequencyQuery);

    // Get daily order trends
    const trendsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders_count
      FROM lab_orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const trendsResult = await db.query(trendsQuery);

    const response: APIResponse = {
      success: true,
      data: {
        overview: {
          totalOrders: parseInt(stats.total_orders),
          pendingOrders: parseInt(stats.pending_orders),
          inProgressOrders: parseInt(stats.in_progress_orders),
          completedOrders: parseInt(stats.completed_orders),
          totalResults: parseInt(stats.total_results),
          pendingResults: parseInt(stats.pending_results),
          reviewedResults: parseInt(stats.reviewed_results)
        },
        testFrequency: testFrequencyResult.rows,
        dailyTrends: trendsResult.rows
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching lab stats:', error);
    throw error;
  }
};