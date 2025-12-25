import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { dbQueryLogger, userActivityLogger } from '@/middleware/logging';
import { setCache, getCache, deleteCache } from '@/config/redis';

const prisma = new PrismaClient();

// Main Dashboard Overview
export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'dashboard:overview';
    
    // Try to get from cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      await userActivityLogger(req, 'dashboard', 'read', { cached: true });
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    await dbQueryLogger('dashboard.overview', { startOfDay, endOfDay, startOfMonth });

    // Parallel queries for better performance
    const [
      totalPatients,
      todayAppointments,
      pendingAppointments,
      totalDoctors,
      totalNurses,
      todayRevenue,
      monthlyRevenue,
      occupiedBeds,
      totalBeds,
      criticalInventory,
      pendingLabTests,
      pendingBills,
    ] = await Promise.all([
      // Total active patients
      prisma.patient.count({
        where: { isActive: true },
      }),

      // Today's appointments
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),

      // Pending appointments
      prisma.appointment.count({
        where: { status: 'scheduled' },
      }),

      // Total doctors
      prisma.user.count({
        where: {
          role: 'doctor',
          isActive: true,
        },
      }),

      // Total nurses
      prisma.user.count({
        where: {
          role: 'nurse',
          isActive: true,
        },
      }),

      // Today's revenue
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // Monthly revenue
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: {
            gte: startOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // Occupied beds (assuming we have bed management)
      prisma.patient.count({
        where: {
          isActive: true,
          // Add bed status condition when bed management is implemented
        },
      }),

      // Total beds (this would come from a beds table in a real implementation)
      Promise.resolve(100), // Placeholder

      // Critical inventory items
      prisma.inventory.count({
        where: {
          OR: [
            { status: 'low_stock' },
            { status: 'out_of_stock' },
          ],
        },
      }),

      // Pending lab tests
      prisma.labOrder.count({
        where: { status: 'pending' },
      }),

      // Pending bills
      prisma.bill.count({
        where: {
          status: {
            in: ['pending', 'partially_paid'],
          },
        },
      }),
    ]);

    const dashboardData = {
      patients: {
        total: totalPatients,
        todayAppointments,
        pendingAppointments,
      },
      staff: {
        doctors: totalDoctors,
        nurses: totalNurses,
      },
      revenue: {
        today: todayRevenue._sum.amount || 0,
        monthly: monthlyRevenue._sum.amount || 0,
      },
      facilities: {
        occupiedBeds,
        totalBeds,
        occupancyRate: Math.round((occupiedBeds / totalBeds) * 100),
      },
      alerts: {
        criticalInventory,
        pendingLabTests,
        pendingBills,
      },
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 5 minutes
    await setCache(cacheKey, dashboardData, 300);
    
    await userActivityLogger(req, 'dashboard', 'read', { 
      totalPatients,
      todayAppointments,
      criticalInventory 
    });

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    logger.error('Error fetching dashboard overview:', error);
    throw new AppError('Failed to fetch dashboard data', 500);
  }
};

// Real-time Statistics
export const getRealTimeStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    await dbQueryLogger('dashboard.realTimeStats', { last24Hours, last7Days });

    // Hourly patient registrations (last 24 hours)
    const hourlyRegistrations = await prisma.$queryRaw`
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as count
      FROM patients 
      WHERE created_at >= ${last24Hours}
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `;

    // Daily appointments (last 7 days)
    const dailyAppointments = await prisma.$queryRaw`
      SELECT 
        DATE(appointment_date) as date,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM appointments 
      WHERE appointment_date >= ${last7Days}
      GROUP BY DATE(appointment_date)
      ORDER BY date
    `;

    // Department-wise patient distribution
    const departmentStats = await prisma.$queryRaw`
      SELECT 
        d.name as department,
        COUNT(DISTINCT a.patient_id) as patients,
        COUNT(a.id) as appointments
      FROM appointments a
      JOIN users u ON a.doctor_id = u.id
      JOIN departments d ON u.department_id = d.id
      WHERE a.appointment_date >= ${last7Days}
      GROUP BY d.id, d.name
      ORDER BY patients DESC
    `;

    // Revenue trend (last 7 days)
    const revenueTrend = await prisma.$queryRaw`
      SELECT 
        DATE(payment_date) as date,
        SUM(amount) as revenue,
        COUNT(*) as transactions
      FROM payments 
      WHERE status = 'completed' 
        AND payment_date >= ${last7Days}
      GROUP BY DATE(payment_date)
      ORDER BY date
    `;

    await userActivityLogger(req, 'dashboard', 'realTimeStats', { 
      period: '7days',
      dataPoints: {
        registrations: hourlyRegistrations.length,
        appointments: dailyAppointments.length,
        departments: departmentStats.length
      }
    });

    res.json({
      success: true,
      data: {
        hourlyRegistrations,
        dailyAppointments,
        departmentStats,
        revenueTrend,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching real-time stats:', error);
    throw new AppError('Failed to fetch real-time statistics', 500);
  }
};

// Performance Metrics
export const getPerformanceMetrics = async (req: Request, res: Response) => {
  try {
    const { period = '30' } = req.query;
    const daysBack = parseInt(period as string);
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Average waiting time (calculated from appointment time to actual start)
    const avgWaitingTime = await prisma.$queryRaw`
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, appointment_time, updated_at)) as avg_waiting_minutes
      FROM appointments 
      WHERE status = 'completed' 
        AND appointment_date >= ${startDate}
        AND updated_at IS NOT NULL
    `;

    // Patient satisfaction (if we have ratings)
    const patientSatisfaction = await prisma.$queryRaw`
      SELECT 
        AVG(rating) as avg_rating,
        COUNT(*) as total_ratings
      FROM medical_records 
      WHERE created_at >= ${startDate}
        AND rating IS NOT NULL
    `;

    // Doctor productivity
    const doctorProductivity = await prisma.$queryRaw`
      SELECT 
        u.first_name,
        u.last_name,
        COUNT(a.id) as appointments_completed,
        COUNT(DISTINCT a.patient_id) as unique_patients,
        AVG(TIMESTAMPDIFF(MINUTE, a.appointment_time, a.updated_at)) as avg_consultation_time
      FROM users u
      LEFT JOIN appointments a ON u.id = a.doctor_id 
        AND a.status = 'completed' 
        AND a.appointment_date >= ${startDate}
      WHERE u.role = 'doctor' AND u.is_active = true
      GROUP BY u.id
      ORDER BY appointments_completed DESC
      LIMIT 10
    `;

    // Bed utilization rate
    const bedUtilization = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as admissions
      FROM patients 
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    // Lab test turnaround time
    const labTurnaroundTime = await prisma.$queryRaw`
      SELECT 
        AVG(TIMESTAMPDIFF(HOUR, lo.order_date, lr.result_date)) as avg_turnaround_hours,
        COUNT(*) as completed_tests
      FROM lab_orders lo
      JOIN lab_results lr ON lo.id = lr.lab_order_id
      WHERE lo.order_date >= ${startDate}
        AND lr.result_date IS NOT NULL
    `;

    res.json({
      success: true,
      data: {
        avgWaitingTime: avgWaitingTime[0]?.avg_waiting_minutes || 0,
        patientSatisfaction: {
          rating: patientSatisfaction[0]?.avg_rating || 0,
          totalRatings: patientSatisfaction[0]?.total_ratings || 0,
        },
        doctorProductivity,
        bedUtilization,
        labTurnaroundTime: labTurnaroundTime[0]?.avg_turnaround_hours || 0,
        period: daysBack,
      },
    });
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching performance metrics',
    });
  }
};

// Financial Dashboard
export const getFinancialDashboard = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const [
      monthlyRevenue,
      yearlyRevenue,
      lastMonthRevenue,
      outstandingAmount,
      topPaymentMethods,
      revenueByDepartment,
    ] = await Promise.all([
      // Current month revenue
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: { gte: startOfMonth },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Current year revenue
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: { gte: startOfYear },
        },
        _sum: { amount: true },
      }),

      // Last month revenue
      prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: {
            gte: lastMonth,
            lt: endOfLastMonth,
          },
        },
        _sum: { amount: true },
      }),

      // Outstanding amount
      prisma.$queryRaw`
        SELECT 
          SUM(b.total_amount - COALESCE(paid.amount, 0)) as outstanding
        FROM bills b
        LEFT JOIN (
          SELECT bill_id, SUM(amount) as amount
          FROM payments 
          WHERE status = 'completed'
          GROUP BY bill_id
        ) paid ON b.id = paid.bill_id
        WHERE b.status IN ('pending', 'partially_paid')
      `,

      // Top payment methods
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          status: 'completed',
          paymentDate: { gte: startOfMonth },
        },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),

      // Revenue by department
      prisma.$queryRaw`
        SELECT 
          d.name as department,
          SUM(p.amount) as revenue,
          COUNT(p.id) as transactions
        FROM payments p
        JOIN bills b ON p.bill_id = b.id
        JOIN patients pt ON b.patient_id = pt.id
        JOIN medical_records mr ON pt.id = mr.patient_id
        JOIN users u ON mr.doctor_id = u.id
        JOIN departments d ON u.department_id = d.id
        WHERE p.status = 'completed'
          AND p.payment_date >= ${startOfMonth}
        GROUP BY d.id, d.name
        ORDER BY revenue DESC
      `,
    ]);

    // Calculate growth rate
    const currentMonthAmount = monthlyRevenue._sum.amount || 0;
    const lastMonthAmount = lastMonthRevenue._sum.amount || 0;
    const growthRate = lastMonthAmount > 0 
      ? ((currentMonthAmount - lastMonthAmount) / lastMonthAmount) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        revenue: {
          monthly: currentMonthAmount,
          yearly: yearlyRevenue._sum.amount || 0,
          growthRate: Math.round(growthRate * 100) / 100,
          transactions: monthlyRevenue._count,
        },
        outstanding: outstandingAmount[0]?.outstanding || 0,
        paymentMethods: topPaymentMethods,
        departmentRevenue: revenueByDepartment,
      },
    });
  } catch (error) {
    logger.error('Error fetching financial dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching financial dashboard',
    });
  }
};

// Operational Dashboard
export const getOperationalDashboard = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [
      todayAppointments,
      emergencyPatients,
      availableDoctors,
      criticalAlerts,
      equipmentStatus,
      staffAttendance,
    ] = await Promise.all([
      // Today's appointment breakdown
      prisma.appointment.groupBy({
        by: ['status'],
        where: {
          appointmentDate: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        _count: { id: true },
      }),

      // Emergency patients
      prisma.patient.count({
        where: {
          // Assuming we have an emergency flag or priority
          createdAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),

      // Available doctors
      prisma.user.count({
        where: {
          role: 'doctor',
          isActive: true,
          // Add availability logic here
        },
      }),

      // Critical alerts
      Promise.all([
        prisma.inventory.count({
          where: { status: 'out_of_stock' },
        }),
        prisma.labOrder.count({
          where: { 
            status: 'pending',
            orderDate: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Older than 24 hours
            },
          },
        }),
      ]),

      // Equipment status (placeholder)
      Promise.resolve({
        operational: 45,
        maintenance: 3,
        outOfOrder: 2,
      }),

      // Staff attendance today
      prisma.employeeAttendance.groupBy({
        by: ['status'],
        where: {
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        _count: { id: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        appointments: todayAppointments,
        emergencyPatients,
        availableDoctors,
        alerts: {
          outOfStockItems: criticalAlerts[0],
          delayedLabTests: criticalAlerts[1],
        },
        equipment: equipmentStatus,
        staffAttendance,
      },
    });
  } catch (error) {
    logger.error('Error fetching operational dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching operational dashboard',
    });
  }
};

// Quality Metrics
export const getQualityMetrics = async (req: Request, res: Response) => {
  try {
    const { period = '30' } = req.query;
    const daysBack = parseInt(period as string);
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Patient readmission rate
    const readmissionRate = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT p1.patient_id) as readmissions,
        COUNT(DISTINCT p2.patient_id) as total_discharges
      FROM medical_records p1
      JOIN medical_records p2 ON p1.patient_id = p2.patient_id
      WHERE p1.created_at >= ${startDate}
        AND p2.created_at < p1.created_at
        AND DATEDIFF(p1.created_at, p2.created_at) <= 30
    `;

    // Infection control metrics
    const infectionMetrics = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_cases,
        SUM(CASE WHEN diagnosis LIKE '%infection%' THEN 1 ELSE 0 END) as infection_cases
      FROM medical_records 
      WHERE created_at >= ${startDate}
    `;

    // Medication error rate
    const medicationErrors = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_prescriptions,
        SUM(CASE WHEN notes LIKE '%error%' OR notes LIKE '%correction%' THEN 1 ELSE 0 END) as errors
      FROM prescriptions 
      WHERE prescribed_date >= ${startDate}
    `;

    // Patient satisfaction scores
    const satisfactionScores = await prisma.$queryRaw`
      SELECT 
        AVG(rating) as avg_rating,
        COUNT(*) as total_ratings,
        SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive_ratings
      FROM medical_records 
      WHERE created_at >= ${startDate}
        AND rating IS NOT NULL
    `;

    res.json({
      success: true,
      data: {
        readmissionRate: {
          rate: readmissionRate[0]?.total_discharges > 0 
            ? (readmissionRate[0]?.readmissions / readmissionRate[0]?.total_discharges) * 100 
            : 0,
          readmissions: readmissionRate[0]?.readmissions || 0,
          totalDischarges: readmissionRate[0]?.total_discharges || 0,
        },
        infectionRate: {
          rate: infectionMetrics[0]?.total_cases > 0 
            ? (infectionMetrics[0]?.infection_cases / infectionMetrics[0]?.total_cases) * 100 
            : 0,
          cases: infectionMetrics[0]?.infection_cases || 0,
          total: infectionMetrics[0]?.total_cases || 0,
        },
        medicationErrorRate: {
          rate: medicationErrors[0]?.total_prescriptions > 0 
            ? (medicationErrors[0]?.errors / medicationErrors[0]?.total_prescriptions) * 100 
            : 0,
          errors: medicationErrors[0]?.errors || 0,
          total: medicationErrors[0]?.total_prescriptions || 0,
        },
        patientSatisfaction: {
          avgRating: satisfactionScores[0]?.avg_rating || 0,
          satisfactionRate: satisfactionScores[0]?.total_ratings > 0 
            ? (satisfactionScores[0]?.positive_ratings / satisfactionScores[0]?.total_ratings) * 100 
            : 0,
          totalRatings: satisfactionScores[0]?.total_ratings || 0,
        },
        period: daysBack,
      },
    });
  } catch (error) {
    logger.error('Error fetching quality metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quality metrics',
    });
  }
};