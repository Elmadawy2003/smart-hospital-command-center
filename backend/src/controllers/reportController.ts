import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { getDatabase } from '@/config/database';
import { getCache, setCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { APIResponse } from '@/types';

export const getPatientReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const {
      startDate,
      endDate,
      department,
      gender,
      ageGroup,
      format = 'json'
    } = req.query;

    const cacheKey = `patient_report_${startDate}_${endDate}_${department}_${gender}_${ageGroup}`;

    // Try to get from cache first
    const cachedReport = await getCache(cacheKey);
    if (cachedReport && format === 'json') {
      const response: APIResponse = {
        success: true,
        data: cachedReport,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();

    // Build WHERE clause
    let whereConditions = ['1=1'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereConditions.push(`p.created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`p.created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    if (gender) {
      whereConditions.push(`p.gender = $${paramIndex}`);
      queryParams.push(gender);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get patient statistics
    const patientStatsQuery = `
      SELECT 
        COUNT(*) as total_patients,
        COUNT(CASE WHEN p.gender = 'male' THEN 1 END) as male_patients,
        COUNT(CASE WHEN p.gender = 'female' THEN 1 END) as female_patients,
        ROUND(AVG(EXTRACT(YEAR FROM AGE(p.date_of_birth)))) as avg_age,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) < 18 THEN 1 END) as pediatric_patients,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 65 THEN 1 END) as geriatric_patients
      FROM patients p
      WHERE ${whereClause}
    `;

    // Get patient registration trends
    const registrationTrendsQuery = `
      SELECT 
        DATE(p.created_at) as registration_date,
        COUNT(*) as new_registrations
      FROM patients p
      WHERE ${whereClause}
      GROUP BY DATE(p.created_at)
      ORDER BY registration_date ASC
    `;

    // Get age distribution
    const ageDistributionQuery = `
      SELECT 
        CASE 
          WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) < 18 THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 31 AND 50 THEN '31-50'
          WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN 51 AND 70 THEN '51-70'
          ELSE 'Over 70'
        END as age_group,
        COUNT(*) as count
      FROM patients p
      WHERE ${whereClause}
      GROUP BY age_group
      ORDER BY 
        CASE age_group
          WHEN 'Under 18' THEN 1
          WHEN '18-30' THEN 2
          WHEN '31-50' THEN 3
          WHEN '51-70' THEN 4
          WHEN 'Over 70' THEN 5
        END
    `;

    // Get blood type distribution
    const bloodTypeQuery = `
      SELECT 
        blood_type,
        COUNT(*) as count
      FROM patients p
      WHERE ${whereClause} AND blood_type IS NOT NULL
      GROUP BY blood_type
      ORDER BY count DESC
    `;

    const [statsResult, trendsResult, ageResult, bloodTypeResult] = await Promise.all([
      db.query(patientStatsQuery, queryParams),
      db.query(registrationTrendsQuery, queryParams),
      db.query(ageDistributionQuery, queryParams),
      db.query(bloodTypeQuery, queryParams)
    ]);

    const reportData = {
      summary: statsResult.rows[0],
      registrationTrends: trendsResult.rows,
      ageDistribution: ageResult.rows,
      bloodTypeDistribution: bloodTypeResult.rows,
      generatedAt: new Date(),
      filters: {
        startDate,
        endDate,
        department,
        gender,
        ageGroup
      }
    };

    // Cache for 30 minutes
    await setCache(cacheKey, reportData, 1800);

    if (format === 'csv') {
      // Generate CSV format
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=patient_report.csv');
      
      let csv = 'Patient Report\n\n';
      csv += 'Summary\n';
      csv += `Total Patients,${reportData.summary.total_patients}\n`;
      csv += `Male Patients,${reportData.summary.male_patients}\n`;
      csv += `Female Patients,${reportData.summary.female_patients}\n`;
      csv += `Average Age,${reportData.summary.avg_age}\n\n`;
      
      csv += 'Age Distribution\n';
      csv += 'Age Group,Count\n';
      reportData.ageDistribution.forEach(row => {
        csv += `${row.age_group},${row.count}\n`;
      });
      
      res.send(csv);
    } else {
      const response: APIResponse = {
        success: true,
        data: reportData,
        timestamp: new Date()
      };
      res.json(response);
    }
  } catch (error) {
    logger.error('Error generating patient report:', error);
    throw error;
  }
};

export const getAppointmentReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const {
      startDate,
      endDate,
      doctorId,
      department,
      status,
      format = 'json'
    } = req.query;

    const db = getDatabase();

    // Build WHERE clause
    let whereConditions = ['1=1'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereConditions.push(`a.appointment_date >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`a.appointment_date <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    if (doctorId) {
      whereConditions.push(`a.doctor_id = $${paramIndex}`);
      queryParams.push(doctorId);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`a.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get appointment statistics
    const appointmentStatsQuery = `
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_show_appointments,
        ROUND(AVG(EXTRACT(EPOCH FROM (a.end_time - a.start_time))/60)) as avg_duration_minutes
      FROM appointments a
      WHERE ${whereClause}
    `;

    // Get daily appointment trends
    const dailyTrendsQuery = `
      SELECT 
        DATE(a.appointment_date) as appointment_date,
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled
      FROM appointments a
      WHERE ${whereClause}
      GROUP BY DATE(a.appointment_date)
      ORDER BY appointment_date ASC
    `;

    // Get doctor performance
    const doctorPerformanceQuery = `
      SELECT 
        u.first_name || ' ' || u.last_name as doctor_name,
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
        ROUND(COUNT(CASE WHEN a.status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate
      FROM appointments a
      JOIN users u ON a.doctor_id = u.id
      WHERE ${whereClause}
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY total_appointments DESC
    `;

    // Get appointment types distribution
    const appointmentTypesQuery = `
      SELECT 
        appointment_type,
        COUNT(*) as count
      FROM appointments a
      WHERE ${whereClause}
      GROUP BY appointment_type
      ORDER BY count DESC
    `;

    const [statsResult, trendsResult, doctorResult, typesResult] = await Promise.all([
      db.query(appointmentStatsQuery, queryParams),
      db.query(dailyTrendsQuery, queryParams),
      db.query(doctorPerformanceQuery, queryParams),
      db.query(appointmentTypesQuery, queryParams)
    ]);

    const reportData = {
      summary: statsResult.rows[0],
      dailyTrends: trendsResult.rows,
      doctorPerformance: doctorResult.rows,
      appointmentTypes: typesResult.rows,
      generatedAt: new Date(),
      filters: {
        startDate,
        endDate,
        doctorId,
        department,
        status
      }
    };

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=appointment_report.csv');
      
      let csv = 'Appointment Report\n\n';
      csv += 'Summary\n';
      csv += `Total Appointments,${reportData.summary.total_appointments}\n`;
      csv += `Completed Appointments,${reportData.summary.completed_appointments}\n`;
      csv += `Cancelled Appointments,${reportData.summary.cancelled_appointments}\n\n`;
      
      csv += 'Doctor Performance\n';
      csv += 'Doctor Name,Total Appointments,Completed,Completion Rate\n';
      reportData.doctorPerformance.forEach(row => {
        csv += `${row.doctor_name},${row.total_appointments},${row.completed_appointments},${row.completion_rate}%\n`;
      });
      
      res.send(csv);
    } else {
      const response: APIResponse = {
        success: true,
        data: reportData,
        timestamp: new Date()
      };
      res.json(response);
    }
  } catch (error) {
    logger.error('Error generating appointment report:', error);
    throw error;
  }
};

export const getFinancialReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const {
      startDate,
      endDate,
      department,
      paymentStatus,
      format = 'json'
    } = req.query;

    const db = getDatabase();

    // Build WHERE clause
    let whereConditions = ['1=1'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereConditions.push(`b.created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`b.created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    if (paymentStatus) {
      whereConditions.push(`b.payment_status = $${paramIndex}`);
      queryParams.push(paymentStatus);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get financial statistics
    const financialStatsQuery = `
      SELECT 
        COUNT(*) as total_bills,
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE 0 END), 0) as collected_revenue,
        COALESCE(SUM(CASE WHEN b.payment_status = 'pending' THEN b.total_amount ELSE 0 END), 0) as pending_revenue,
        COALESCE(SUM(CASE WHEN b.payment_status = 'overdue' THEN b.total_amount ELSE 0 END), 0) as overdue_revenue,
        ROUND(AVG(b.total_amount), 2) as avg_bill_amount
      FROM bills b
      WHERE ${whereClause}
    `;

    // Get daily revenue trends
    const revenueTrendsQuery = `
      SELECT 
        DATE(b.created_at) as bill_date,
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE 0 END), 0) as collected_revenue,
        COUNT(*) as bill_count
      FROM bills b
      WHERE ${whereClause}
      GROUP BY DATE(b.created_at)
      ORDER BY bill_date ASC
    `;

    // Get revenue by service type
    const serviceRevenueQuery = `
      SELECT 
        bi.service_type,
        COALESCE(SUM(bi.amount), 0) as revenue,
        COUNT(*) as service_count
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      WHERE ${whereClause}
      GROUP BY bi.service_type
      ORDER BY revenue DESC
    `;

    // Get payment methods distribution
    const paymentMethodsQuery = `
      SELECT 
        p.payment_method,
        COALESCE(SUM(p.amount), 0) as total_amount,
        COUNT(*) as transaction_count
      FROM payments p
      JOIN bills b ON p.bill_id = b.id
      WHERE ${whereClause}
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `;

    const [statsResult, trendsResult, serviceResult, paymentResult] = await Promise.all([
      db.query(financialStatsQuery, queryParams),
      db.query(revenueTrendsQuery, queryParams),
      db.query(serviceRevenueQuery, queryParams),
      db.query(paymentMethodsQuery, queryParams)
    ]);

    const reportData = {
      summary: {
        ...statsResult.rows[0],
        collection_rate: statsResult.rows[0].total_revenue > 0 ? 
          (parseFloat(statsResult.rows[0].collected_revenue) / parseFloat(statsResult.rows[0].total_revenue)) * 100 : 0
      },
      revenueTrends: trendsResult.rows,
      serviceRevenue: serviceResult.rows,
      paymentMethods: paymentResult.rows,
      generatedAt: new Date(),
      filters: {
        startDate,
        endDate,
        department,
        paymentStatus
      }
    };

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=financial_report.csv');
      
      let csv = 'Financial Report\n\n';
      csv += 'Summary\n';
      csv += `Total Bills,${reportData.summary.total_bills}\n`;
      csv += `Total Revenue,${reportData.summary.total_revenue}\n`;
      csv += `Collected Revenue,${reportData.summary.collected_revenue}\n`;
      csv += `Pending Revenue,${reportData.summary.pending_revenue}\n`;
      csv += `Collection Rate,${reportData.summary.collection_rate.toFixed(2)}%\n\n`;
      
      csv += 'Service Revenue\n';
      csv += 'Service Type,Revenue,Count\n';
      reportData.serviceRevenue.forEach(row => {
        csv += `${row.service_type},${row.revenue},${row.service_count}\n`;
      });
      
      res.send(csv);
    } else {
      const response: APIResponse = {
        success: true,
        data: reportData,
        timestamp: new Date()
      };
      res.json(response);
    }
  } catch (error) {
    logger.error('Error generating financial report:', error);
    throw error;
  }
};

export const getInventoryReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const {
      category,
      status,
      lowStockThreshold = 10,
      format = 'json'
    } = req.query;

    const db = getDatabase();

    // Build WHERE clause
    let whereConditions = ['1=1'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereConditions.push(`i.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`i.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get inventory statistics
    const inventoryStatsQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN i.current_stock <= $${paramIndex} THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN i.current_stock = 0 THEN 1 END) as out_of_stock_items,
        COUNT(CASE WHEN i.expiry_date IS NOT NULL AND i.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as expiring_items,
        COALESCE(SUM(i.current_stock * i.unit_cost), 0) as total_inventory_value
      FROM inventory_items i
      WHERE ${whereClause}
    `;

    queryParams.push(lowStockThreshold);

    // Get category distribution
    const categoryDistributionQuery = `
      SELECT 
        i.category,
        COUNT(*) as item_count,
        COALESCE(SUM(i.current_stock), 0) as total_stock,
        COALESCE(SUM(i.current_stock * i.unit_cost), 0) as category_value
      FROM inventory_items i
      WHERE ${whereClause}
      GROUP BY i.category
      ORDER BY category_value DESC
    `;

    // Get low stock items
    const lowStockQuery = `
      SELECT 
        i.name,
        i.category,
        i.current_stock,
        i.minimum_stock,
        i.unit_cost,
        i.expiry_date
      FROM inventory_items i
      WHERE ${whereClause} AND i.current_stock <= $${paramIndex}
      ORDER BY i.current_stock ASC
    `;

    // Get expiring items
    const expiringItemsQuery = `
      SELECT 
        i.name,
        i.category,
        i.current_stock,
        i.expiry_date,
        i.unit_cost
      FROM inventory_items i
      WHERE ${whereClause} AND i.expiry_date IS NOT NULL AND i.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY i.expiry_date ASC
    `;

    const [statsResult, categoryResult, lowStockResult, expiringResult] = await Promise.all([
      db.query(inventoryStatsQuery, queryParams),
      db.query(categoryDistributionQuery, queryParams.slice(0, -1)), // Remove lowStockThreshold for category query
      db.query(lowStockQuery, queryParams),
      db.query(expiringItemsQuery, queryParams.slice(0, -1)) // Remove lowStockThreshold for expiring query
    ]);

    const reportData = {
      summary: statsResult.rows[0],
      categoryDistribution: categoryResult.rows,
      lowStockItems: lowStockResult.rows,
      expiringItems: expiringResult.rows,
      generatedAt: new Date(),
      filters: {
        category,
        status,
        lowStockThreshold
      }
    };

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.csv');
      
      let csv = 'Inventory Report\n\n';
      csv += 'Summary\n';
      csv += `Total Items,${reportData.summary.total_items}\n`;
      csv += `Low Stock Items,${reportData.summary.low_stock_items}\n`;
      csv += `Out of Stock Items,${reportData.summary.out_of_stock_items}\n`;
      csv += `Total Inventory Value,${reportData.summary.total_inventory_value}\n\n`;
      
      csv += 'Low Stock Items\n';
      csv += 'Item Name,Category,Current Stock,Minimum Stock,Unit Cost\n';
      reportData.lowStockItems.forEach(row => {
        csv += `${row.name},${row.category},${row.current_stock},${row.minimum_stock},${row.unit_cost}\n`;
      });
      
      res.send(csv);
    } else {
      const response: APIResponse = {
        success: true,
        data: reportData,
        timestamp: new Date()
      };
      res.json(response);
    }
  } catch (error) {
    logger.error('Error generating inventory report:', error);
    throw error;
  }
};

export const getLabReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const {
      startDate,
      endDate,
      testType,
      status,
      format = 'json'
    } = req.query;

    const db = getDatabase();

    // Build WHERE clause
    let whereConditions = ['1=1'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereConditions.push(`lo.created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`lo.created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    if (testType) {
      whereConditions.push(`lr.test_name = $${paramIndex}`);
      queryParams.push(testType);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`lo.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get lab statistics
    const labStatsQuery = `
      SELECT 
        COUNT(DISTINCT lo.id) as total_orders,
        COUNT(DISTINCT lr.id) as total_results,
        COUNT(CASE WHEN lo.status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN lo.status = 'completed' THEN 1 END) as completed_orders,
        ROUND(AVG(EXTRACT(EPOCH FROM (lr.created_at - lo.created_at))/3600), 2) as avg_turnaround_hours
      FROM lab_orders lo
      LEFT JOIN lab_results lr ON lo.id = lr.order_id
      WHERE ${whereClause}
    `;

    // Get test frequency
    const testFrequencyQuery = `
      SELECT 
        lr.test_name,
        COUNT(*) as frequency,
        COUNT(CASE WHEN lr.is_abnormal = true THEN 1 END) as abnormal_results
      FROM lab_results lr
      JOIN lab_orders lo ON lr.order_id = lo.id
      WHERE ${whereClause}
      GROUP BY lr.test_name
      ORDER BY frequency DESC
      LIMIT 20
    `;

    // Get daily lab trends
    const dailyTrendsQuery = `
      SELECT 
        DATE(lo.created_at) as order_date,
        COUNT(DISTINCT lo.id) as orders_count,
        COUNT(DISTINCT lr.id) as results_count
      FROM lab_orders lo
      LEFT JOIN lab_results lr ON lo.id = lr.order_id
      WHERE ${whereClause}
      GROUP BY DATE(lo.created_at)
      ORDER BY order_date ASC
    `;

    const [statsResult, frequencyResult, trendsResult] = await Promise.all([
      db.query(labStatsQuery, queryParams),
      db.query(testFrequencyQuery, queryParams),
      db.query(dailyTrendsQuery, queryParams)
    ]);

    const reportData = {
      summary: statsResult.rows[0],
      testFrequency: frequencyResult.rows,
      dailyTrends: trendsResult.rows,
      generatedAt: new Date(),
      filters: {
        startDate,
        endDate,
        testType,
        status
      }
    };

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=lab_report.csv');
      
      let csv = 'Lab Report\n\n';
      csv += 'Summary\n';
      csv += `Total Orders,${reportData.summary.total_orders}\n`;
      csv += `Total Results,${reportData.summary.total_results}\n`;
      csv += `Pending Orders,${reportData.summary.pending_orders}\n`;
      csv += `Average Turnaround (hours),${reportData.summary.avg_turnaround_hours}\n\n`;
      
      csv += 'Test Frequency\n';
      csv += 'Test Name,Frequency,Abnormal Results\n';
      reportData.testFrequency.forEach(row => {
        csv += `${row.test_name},${row.frequency},${row.abnormal_results}\n`;
      });
      
      res.send(csv);
    } else {
      const response: APIResponse = {
        success: true,
        data: reportData,
        timestamp: new Date()
      };
      res.json(response);
    }
  } catch (error) {
    logger.error('Error generating lab report:', error);
    throw error;
  }
};