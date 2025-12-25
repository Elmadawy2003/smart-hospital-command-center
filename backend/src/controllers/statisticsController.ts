import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { dbQueryLogger } from '@/utils/logger';

const prisma = new PrismaClient();

// User Activity Logger Helper Function
const userActivityLogger = (userId: string, action: string, details: any) => {
  logger.info('User activity', {
    userId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
};

// Hospital Overview Statistics
export const getHospitalOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cacheKey = 'hospital:overview:stats';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'hospital_overview_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Hospital overview retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();
    
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalPatients,
      activePatients,
      totalStaff,
      activeStaff,
      totalDepartments,
      todayAppointments,
      monthlyAppointments,
      yearlyAppointments,
      todayRevenue,
      monthlyRevenue,
      yearlyRevenue,
      occupiedBeds,
      totalBeds,
      criticalInventory,
      pendingLabTests,
      pendingBills
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.patient.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.department.count({ where: { isActive: true } }),
      
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: startOfDay,
            lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: startOfMonth
          }
        }
      }),
      
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: startOfYear
          }
        }
      }),
      
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: {
            gte: startOfDay,
            lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
          }
        },
        _sum: { amount: true }
      }),
      
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: { gte: startOfMonth }
        },
        _sum: { amount: true }
      }),
      
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: { gte: startOfYear }
        },
        _sum: { amount: true }
      }),
      
      prisma.patient.count({ where: { isActive: true } }), // Placeholder for bed occupancy
      Promise.resolve(100), // Placeholder for total beds
      
      prisma.inventory.count({
        where: {
          OR: [
            { status: 'low_stock' },
            { status: 'out_of_stock' }
          ]
        }
      }),
      
      prisma.labOrder.count({ where: { status: 'pending' } }),
      
      prisma.bill.count({
        where: {
          status: {
            in: ['pending', 'partially_paid']
          }
        }
      })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Hospital overview statistics', [], endTime - startTime);

    const overviewData = {
      patients: {
        total: totalPatients,
        active: activePatients,
        inactive: totalPatients - activePatients
      },
      staff: {
        total: totalStaff,
        active: activeStaff,
        inactive: totalStaff - activeStaff
      },
      departments: {
        total: totalDepartments
      },
      appointments: {
        today: todayAppointments,
        thisMonth: monthlyAppointments,
        thisYear: yearlyAppointments
      },
      revenue: {
        today: todayRevenue._sum.amount || 0,
        thisMonth: monthlyRevenue._sum.amount || 0,
        thisYear: yearlyRevenue._sum.amount || 0
      },
      facilities: {
        occupiedBeds,
        totalBeds,
        occupancyRate: Math.round((occupiedBeds / totalBeds) * 100)
      },
      alerts: {
        criticalInventory,
        pendingLabTests,
        pendingBills
      },
      lastUpdated: new Date().toISOString()
    };

    await setCache(cacheKey, overviewData, 300); // Cache for 5 minutes

    userActivityLogger(req.user?.id || 'unknown', 'hospital_overview_view', {
      totalPatients,
      todayAppointments,
      todayRevenue: overviewData.revenue.today
    });

    res.json({
      success: true,
      data: overviewData,
      message: 'Hospital overview statistics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching hospital overview:', error);
    throw new AppError('Failed to fetch hospital overview statistics', 500);
  }
};

// Department Performance Statistics
export const getDepartmentPerformance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const cacheKey = `department:performance:${start.toISOString()}:${end.toISOString()}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'department_performance_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Department performance retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();

    // Department-wise statistics
    const departmentStats = await prisma.$queryRaw<any[]>`
      SELECT 
        d.id,
        d.name,
        d.location,
        COUNT(DISTINCT u.id) as staff_count,
        COUNT(DISTINCT a.id) as appointments_count,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN a.id END) as cancelled_appointments,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        AVG(CASE WHEN a.status = 'completed' THEN a.duration END) as avg_appointment_duration
      FROM departments d
      LEFT JOIN users u ON d.id = u.department_id AND u.is_active = true
      LEFT JOIN appointments a ON u.id = a.doctor_id 
        AND a.appointment_date >= ${start} 
        AND a.appointment_date <= ${end}
      LEFT JOIN bills b ON a.id = b.appointment_id
      LEFT JOIN payments p ON b.id = p.bill_id AND p.status = 'completed'
      WHERE d.is_active = true
      GROUP BY d.id, d.name, d.location
      ORDER BY total_revenue DESC
    `;

    // Patient satisfaction by department (if we have ratings)
    const patientSatisfaction = await prisma.$queryRaw<any[]>`
      SELECT 
        d.name as department,
        AVG(CAST(mr.notes AS DECIMAL)) as avg_rating
      FROM departments d
      JOIN users u ON d.id = u.department_id
      JOIN medical_records mr ON u.id = mr.doctor_id
      WHERE mr.created_at >= ${start} 
        AND mr.created_at <= ${end}
        AND mr.notes ~ '^[0-9](\.[0-9])?$'
      GROUP BY d.id, d.name
      ORDER BY avg_rating DESC
    `;

    const endTime = performance.now();
    dbQueryLogger('Department performance statistics', [start, end], endTime - startTime);

    const performanceData = {
      departments: departmentStats.map(dept => ({
        id: dept.id,
        name: dept.name,
        location: dept.location,
        staffCount: parseInt(dept.staff_count) || 0,
        appointments: {
          total: parseInt(dept.appointments_count) || 0,
          completed: parseInt(dept.completed_appointments) || 0,
          cancelled: parseInt(dept.cancelled_appointments) || 0,
          completionRate: dept.appointments_count > 0 
            ? Math.round((dept.completed_appointments / dept.appointments_count) * 100) 
            : 0
        },
        revenue: parseFloat(dept.total_revenue) || 0,
        avgAppointmentDuration: parseFloat(dept.avg_appointment_duration) || 0
      })),
      patientSatisfaction: patientSatisfaction.map(sat => ({
        department: sat.department,
        avgRating: parseFloat(sat.avg_rating) || 0
      })),
      period: { startDate: start, endDate: end }
    };

    await setCache(cacheKey, performanceData, 1800); // Cache for 30 minutes

    userActivityLogger(req.user?.id || 'unknown', 'department_performance_view', {
      period: `${start.toISOString()} to ${end.toISOString()}`,
      departmentCount: departmentStats.length
    });

    res.json({
      success: true,
      data: performanceData,
      message: 'Department performance statistics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching department performance:', error);
    throw new AppError('Failed to fetch department performance statistics', 500);
  }
};

// Financial Analytics
export const getFinancialAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, granularity = 'daily' } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const cacheKey = `financial:analytics:${start.toISOString()}:${end.toISOString()}:${granularity}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'financial_analytics_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Financial analytics retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();

    // Revenue trends based on granularity
    let dateFormat = 'DATE(p.payment_date)';
    if (granularity === 'weekly') {
      dateFormat = 'YEARWEEK(p.payment_date)';
    } else if (granularity === 'monthly') {
      dateFormat = 'DATE_FORMAT(p.payment_date, "%Y-%m")';
    }

    const revenueTrends = await prisma.$queryRaw<any[]>`
      SELECT 
        ${dateFormat} as period,
        COUNT(p.id) as transaction_count,
        SUM(p.amount) as total_revenue,
        AVG(p.amount) as avg_transaction,
        COUNT(DISTINCT b.patient_id) as unique_patients
      FROM payments p
      JOIN bills b ON p.bill_id = b.id
      WHERE p.status = 'completed'
        AND p.payment_date >= ${start}
        AND p.payment_date <= ${end}
      GROUP BY ${dateFormat}
      ORDER BY period
    `;

    // Payment method distribution
    const paymentMethods = await prisma.$queryRaw<any[]>`
      SELECT 
        p.payment_method,
        COUNT(p.id) as transaction_count,
        SUM(p.amount) as total_amount,
        AVG(p.amount) as avg_amount
      FROM payments p
      WHERE p.status = 'completed'
        AND p.payment_date >= ${start}
        AND p.payment_date <= ${end}
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `;

    // Outstanding bills analysis
    const outstandingBills = await prisma.$queryRaw<any[]>`
      SELECT 
        CASE 
          WHEN DATEDIFF(NOW(), b.created_at) <= 30 THEN '0-30 days'
          WHEN DATEDIFF(NOW(), b.created_at) <= 60 THEN '31-60 days'
          WHEN DATEDIFF(NOW(), b.created_at) <= 90 THEN '61-90 days'
          ELSE '90+ days'
        END as age_group,
        COUNT(b.id) as bill_count,
        SUM(b.total_amount - COALESCE(paid.amount, 0)) as outstanding_amount
      FROM bills b
      LEFT JOIN (
        SELECT bill_id, SUM(amount) as amount
        FROM payments 
        WHERE status = 'completed'
        GROUP BY bill_id
      ) paid ON b.id = paid.bill_id
      WHERE b.status IN ('pending', 'partially_paid')
      GROUP BY age_group
      ORDER BY 
        CASE age_group
          WHEN '0-30 days' THEN 1
          WHEN '31-60 days' THEN 2
          WHEN '61-90 days' THEN 3
          ELSE 4
        END
    `;

    // Top revenue generating services
    const topServices = await prisma.$queryRaw<any[]>`
      SELECT 
        bi.service_name,
        COUNT(bi.id) as service_count,
        SUM(bi.amount) as total_revenue,
        AVG(bi.amount) as avg_price
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      JOIN payments p ON b.id = p.bill_id
      WHERE p.status = 'completed'
        AND p.payment_date >= ${start}
        AND p.payment_date <= ${end}
      GROUP BY bi.service_name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    const endTime = performance.now();
    dbQueryLogger('Financial analytics', [start, end], endTime - startTime);

    const analyticsData = {
      summary: {
        totalRevenue: revenueTrends.reduce((sum, item) => sum + parseFloat(item.total_revenue), 0),
        totalTransactions: revenueTrends.reduce((sum, item) => sum + parseInt(item.transaction_count), 0),
        avgTransactionValue: revenueTrends.length > 0 
          ? revenueTrends.reduce((sum, item) => sum + parseFloat(item.avg_transaction), 0) / revenueTrends.length 
          : 0,
        uniquePatients: Math.max(...revenueTrends.map(item => parseInt(item.unique_patients) || 0))
      },
      revenueTrends: revenueTrends.map(item => ({
        period: item.period,
        revenue: parseFloat(item.total_revenue),
        transactions: parseInt(item.transaction_count),
        avgTransaction: parseFloat(item.avg_transaction),
        uniquePatients: parseInt(item.unique_patients)
      })),
      paymentMethods: paymentMethods.map(method => ({
        method: method.payment_method,
        count: parseInt(method.transaction_count),
        amount: parseFloat(method.total_amount),
        avgAmount: parseFloat(method.avg_amount)
      })),
      outstandingBills: outstandingBills.map(bill => ({
        ageGroup: bill.age_group,
        count: parseInt(bill.bill_count),
        amount: parseFloat(bill.outstanding_amount)
      })),
      topServices: topServices.map(service => ({
        name: service.service_name,
        count: parseInt(service.service_count),
        revenue: parseFloat(service.total_revenue),
        avgPrice: parseFloat(service.avg_price)
      })),
      period: { startDate: start, endDate: end, granularity }
    };

    await setCache(cacheKey, analyticsData, 1800); // Cache for 30 minutes

    userActivityLogger(req.user?.id || 'unknown', 'financial_analytics_view', {
      period: `${start.toISOString()} to ${end.toISOString()}`,
      granularity,
      totalRevenue: analyticsData.summary.totalRevenue
    });

    res.json({
      success: true,
      data: analyticsData,
      message: 'Financial analytics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching financial analytics:', error);
    throw new AppError('Failed to fetch financial analytics', 500);
  }
};

// Patient Demographics and Trends
export const getPatientDemographics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cacheKey = 'patient:demographics:stats';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'patient_demographics_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Patient demographics retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();

    // Age distribution
    const ageDistribution = await prisma.$queryRaw<any[]>`
      SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) < 18 THEN 'Under 18'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 18 AND 30 THEN '18-30'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 31 AND 50 THEN '31-50'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 51 AND 70 THEN '51-70'
          ELSE 'Over 70'
        END as age_group,
        COUNT(*) as patient_count,
        COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_count,
        COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_count
      FROM patients
      WHERE is_active = true
      GROUP BY age_group
      ORDER BY 
        CASE age_group
          WHEN 'Under 18' THEN 1
          WHEN '18-30' THEN 2
          WHEN '31-50' THEN 3
          WHEN '51-70' THEN 4
          ELSE 5
        END
    `;

    // Gender distribution
    const genderDistribution = await prisma.patient.groupBy({
      by: ['gender'],
      where: { isActive: true },
      _count: { id: true }
    });

    // Blood type distribution
    const bloodTypeDistribution = await prisma.patient.groupBy({
      by: ['bloodType'],
      where: { isActive: true },
      _count: { id: true }
    });

    // Marital status distribution
    const maritalStatusDistribution = await prisma.patient.groupBy({
      by: ['maritalStatus'],
      where: { isActive: true },
      _count: { id: true }
    });

    // Patient registration trends (last 12 months)
    const registrationTrends = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as new_patients
      FROM patients
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `;

    // Most common conditions/diagnoses
    const commonConditions = await prisma.$queryRaw<any[]>`
      SELECT 
        diagnosis,
        COUNT(*) as frequency
      FROM medical_records
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        AND diagnosis IS NOT NULL
        AND diagnosis != ''
      GROUP BY diagnosis
      ORDER BY frequency DESC
      LIMIT 10
    `;

    const endTime = performance.now();
    dbQueryLogger('Patient demographics statistics', [], endTime - startTime);

    const demographicsData = {
      ageDistribution: ageDistribution.map(item => ({
        ageGroup: item.age_group,
        total: parseInt(item.patient_count),
        male: parseInt(item.male_count),
        female: parseInt(item.female_count)
      })),
      genderDistribution: genderDistribution.map(item => ({
        gender: item.gender,
        count: item._count.id
      })),
      bloodTypeDistribution: bloodTypeDistribution.map(item => ({
        bloodType: item.bloodType,
        count: item._count.id
      })),
      maritalStatusDistribution: maritalStatusDistribution.map(item => ({
        status: item.maritalStatus,
        count: item._count.id
      })),
      registrationTrends: registrationTrends.map(item => ({
        month: item.month,
        newPatients: parseInt(item.new_patients)
      })),
      commonConditions: commonConditions.map(item => ({
        condition: item.diagnosis,
        frequency: parseInt(item.frequency)
      })),
      lastUpdated: new Date().toISOString()
    };

    await setCache(cacheKey, demographicsData, 3600); // Cache for 1 hour

    userActivityLogger(req.user?.id || 'unknown', 'patient_demographics_view', {
      totalAgeGroups: ageDistribution.length,
      totalConditions: commonConditions.length
    });

    res.json({
      success: true,
      data: demographicsData,
      message: 'Patient demographics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching patient demographics:', error);
    throw new AppError('Failed to fetch patient demographics', 500);
  }
};

// Operational Efficiency Metrics
export const getOperationalMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const cacheKey = `operational:metrics:${start.toISOString()}:${end.toISOString()}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'operational_metrics_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Operational metrics retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();

    // Appointment efficiency
    const appointmentMetrics = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_appointments,
        AVG(duration) as avg_duration,
        AVG(CASE WHEN status = 'completed' THEN duration END) as avg_completed_duration
      FROM appointments
      WHERE appointment_date >= ${start}
        AND appointment_date <= ${end}
    `;

    // Staff productivity
    const staffProductivity = await prisma.$queryRaw<any[]>`
      SELECT 
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as staff_name,
        u.role,
        d.name as department,
        COUNT(a.id) as appointments_handled,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
        AVG(a.duration) as avg_appointment_duration
      FROM users u
      JOIN departments d ON u.department_id = d.id
      LEFT JOIN appointments a ON u.id = a.doctor_id 
        AND a.appointment_date >= ${start} 
        AND a.appointment_date <= ${end}
      WHERE u.role IN ('doctor', 'nurse')
        AND u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name, u.role, d.name
      ORDER BY appointments_handled DESC
    `;

    // Lab turnaround times
    const labMetrics = await prisma.$queryRaw<any[]>`
      SELECT 
        lt.name as test_type,
        COUNT(lo.id) as total_orders,
        COUNT(lr.id) as completed_tests,
        AVG(TIMESTAMPDIFF(HOUR, lo.created_at, lr.result_date)) as avg_turnaround_hours
      FROM lab_orders lo
      JOIN lab_tests lt ON lo.test_id = lt.id
      LEFT JOIN lab_results lr ON lo.id = lr.order_id
      WHERE lo.created_at >= ${start}
        AND lo.created_at <= ${end}
      GROUP BY lt.id, lt.name
      ORDER BY total_orders DESC
    `;

    // Inventory turnover
    const inventoryMetrics = await prisma.$queryRaw<any[]>`
      SELECT 
        m.name as medication_name,
        m.category,
        i.current_stock,
        i.minimum_stock,
        COUNT(p.id) as prescriptions_count,
        SUM(p.quantity) as total_dispensed
      FROM medications m
      JOIN inventory i ON m.id = i.medication_id
      LEFT JOIN prescriptions p ON m.id = p.medication_id
        AND p.created_at >= ${start}
        AND p.created_at <= ${end}
      WHERE i.status = 'available'
      GROUP BY m.id, m.name, m.category, i.current_stock, i.minimum_stock
      ORDER BY total_dispensed DESC
      LIMIT 20
    `;

    // Patient wait times (if we track this)
    const waitTimeMetrics = await prisma.$queryRaw<any[]>`
      SELECT 
        d.name as department,
        AVG(TIMESTAMPDIFF(MINUTE, a.appointment_date, a.updated_at)) as avg_wait_minutes,
        COUNT(a.id) as total_appointments
      FROM appointments a
      JOIN users u ON a.doctor_id = u.id
      JOIN departments d ON u.department_id = d.id
      WHERE a.status = 'completed'
        AND a.appointment_date >= ${start}
        AND a.appointment_date <= ${end}
      GROUP BY d.id, d.name
      ORDER BY avg_wait_minutes
    `;

    const endTime = performance.now();
    dbQueryLogger('Operational metrics', [start, end], endTime - startTime);

    const metricsData = {
      appointments: {
        total: parseInt(appointmentMetrics[0]?.total_appointments) || 0,
        completed: parseInt(appointmentMetrics[0]?.completed_appointments) || 0,
        cancelled: parseInt(appointmentMetrics[0]?.cancelled_appointments) || 0,
        noShow: parseInt(appointmentMetrics[0]?.no_show_appointments) || 0,
        completionRate: appointmentMetrics[0]?.total_appointments > 0 
          ? Math.round((appointmentMetrics[0]?.completed_appointments / appointmentMetrics[0]?.total_appointments) * 100)
          : 0,
        avgDuration: parseFloat(appointmentMetrics[0]?.avg_duration) || 0
      },
      staffProductivity: staffProductivity.map(staff => ({
        id: staff.id,
        name: staff.staff_name,
        role: staff.role,
        department: staff.department,
        appointmentsHandled: parseInt(staff.appointments_handled) || 0,
        completedAppointments: parseInt(staff.completed_appointments) || 0,
        avgDuration: parseFloat(staff.avg_appointment_duration) || 0,
        efficiency: staff.appointments_handled > 0 
          ? Math.round((staff.completed_appointments / staff.appointments_handled) * 100)
          : 0
      })),
      labMetrics: labMetrics.map(lab => ({
        testType: lab.test_type,
        totalOrders: parseInt(lab.total_orders) || 0,
        completedTests: parseInt(lab.completed_tests) || 0,
        avgTurnaroundHours: parseFloat(lab.avg_turnaround_hours) || 0,
        completionRate: lab.total_orders > 0 
          ? Math.round((lab.completed_tests / lab.total_orders) * 100)
          : 0
      })),
      inventoryMetrics: inventoryMetrics.map(inv => ({
        medicationName: inv.medication_name,
        category: inv.category,
        currentStock: parseInt(inv.current_stock) || 0,
        minimumStock: parseInt(inv.minimum_stock) || 0,
        prescriptionsCount: parseInt(inv.prescriptions_count) || 0,
        totalDispensed: parseInt(inv.total_dispensed) || 0,
        stockLevel: inv.current_stock > inv.minimum_stock ? 'adequate' : 'low'
      })),
      waitTimes: waitTimeMetrics.map(wait => ({
        department: wait.department,
        avgWaitMinutes: parseFloat(wait.avg_wait_minutes) || 0,
        totalAppointments: parseInt(wait.total_appointments) || 0
      })),
      period: { startDate: start, endDate: end }
    };

    await setCache(cacheKey, metricsData, 1800); // Cache for 30 minutes

    userActivityLogger(req.user?.id || 'unknown', 'operational_metrics_view', {
      period: `${start.toISOString()} to ${end.toISOString()}`,
      totalAppointments: metricsData.appointments.total,
      staffCount: staffProductivity.length
    });

    res.json({
      success: true,
      data: metricsData,
      message: 'Operational metrics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching operational metrics:', error);
    throw new AppError('Failed to fetch operational metrics', 500);
  }
};

// Export all functions
export default {
  getHospitalOverview,
  getDepartmentPerformance,
  getFinancialAnalytics,
  getPatientDemographics,
  getOperationalMetrics
};