import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { dbQueryLogger, userActivityLogger } from '@/middleware/logging';
import { setCache, getCache, deleteCache } from '@/config/redis';

const prisma = new PrismaClient();

// Bills Management
export const getBills = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, patientId, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Create cache key
    const cacheKey = `bills:${page}:${limit}:${status || 'all'}:${patientId || 'all'}:${startDate || 'all'}:${endDate || 'all'}`;
    
    // Check cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      await userActivityLogger(req, 'bills', 'read', { cached: true });
      return res.json({
        success: true,
        data: cachedData
      });
    }

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (patientId) {
      where.patientId = Number(patientId);
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    await dbQueryLogger('bill.findMany', where);
    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          },
          billItems: {
            include: {
              service: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.bill.count({ where })
    ]);

    const responseData = {
      bills,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    };

    // Cache the result for 5 minutes
    await setCache(cacheKey, responseData, 300);
    
    await userActivityLogger(req, 'bills', 'read', { count: bills.length });

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Error fetching bills:', error);
    throw new AppError('Failed to fetch bills', 500);
  }
};

export const getBillById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Create cache key
    const cacheKey = `bill:${id}`;
    
    // Check cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      await userActivityLogger(req, 'bill', 'read', { billId: id, cached: true });
      return res.json({
        success: true,
        data: cachedData
      });
    }

    await dbQueryLogger('bill.findUnique', { id });
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientNumber: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        billItems: {
          include: {
            medication: {
              select: {
                name: true,
                genericName: true,
                form: true,
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    // Cache the result for 10 minutes
    await setCache(cacheKey, bill, 600);
    
    await userActivityLogger(req, 'bill', 'read', { billId: id });

    res.json({
      success: true,
      data: bill,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Error fetching bill:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching bill',
      });
    }
  }
};

export const createBill = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { patientId, items, discount = 0, tax = 0 } = req.body;

    // Generate bill number
    const billNumber = `BILL-${Date.now()}`;

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.unitPrice;
    }

    const discountAmount = (subtotal * discount) / 100;
    const taxAmount = ((subtotal - discountAmount) * tax) / 100;
    const totalAmount = subtotal - discountAmount + taxAmount;

    await dbQueryLogger('bill.create', { billNumber, patientId, totalAmount });

    // Create bill and bill items in a transaction
    const bill = await prisma.$transaction(async (tx) => {
      const newBill = await tx.bill.create({
        data: {
          billNumber,
          patientId,
          subtotal,
          discount,
          discountAmount,
          tax,
          taxAmount,
          totalAmount,
          status: 'pending'
        }
      });

      // Create bill items
      const billItems = await Promise.all(
        items.map((item: any) =>
          tx.billItem.create({
            data: {
              billId: newBill.id,
              serviceId: item.serviceId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice
            }
          })
        )
      );

      return { ...newBill, billItems };
    });

    // Invalidate bills cache
    await deleteCache('bills:*');
    
    await userActivityLogger(req, 'bill', 'create', { 
      billId: bill.id, 
      billNumber: bill.billNumber,
      totalAmount: bill.totalAmount 
    });

    logger.info(`Bill created: ${bill.billNumber}`);

    res.status(201).json({
      success: true,
      data: bill,
      message: 'Bill created successfully'
    });
  } catch (error) {
    logger.error('Error creating bill:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to create bill', 500);
  }
};

export const updateBill = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const bill = await prisma.bill.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            patientNumber: true,
          },
        },
        billItems: true,
      },
    });

    logger.info(`Bill updated: ${id}`, {
      userId: req.user?.id,
      billId: id,
    });

    res.json({
      success: true,
      data: bill,
      message: 'Bill updated successfully',
    });
  } catch (error) {
    logger.error('Error updating bill:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating bill',
    });
  }
};

// Payments Management
export const getPayments = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, paymentMethod, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          bill: {
            include: {
              patient: {
                select: {
                  firstName: true,
                  lastName: true,
                  patientNumber: true,
                },
              },
            },
          },
        },
        skip: offset,
        take: Number(limit),
        orderBy: { paymentDate: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
    });
  }
};

export const createPayment = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { billId, amount, paymentMethod, transactionId, notes } = req.body;

    await dbQueryLogger('bill.findUnique', { billId });

    // Check if bill exists and get current payment status
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        payments: {
          where: { status: 'completed' },
        },
      },
    });

    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    // Calculate total paid amount
    const totalPaid = bill.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingAmount = bill.totalAmount - totalPaid;

    if (amount > remainingAmount) {
      throw new AppError('Payment amount exceeds remaining balance', 400);
    }

    await dbQueryLogger('payment.create', { billId, amount, paymentMethod });

    // Create payment and update bill status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          billId,
          amount,
          paymentMethod,
          transactionId,
          notes,
          paymentDate: new Date(),
          status: 'completed',
        },
      });

      // Update bill status based on payment
      const newTotalPaid = totalPaid + amount;
      let billStatus = 'pending';
      
      if (newTotalPaid >= bill.totalAmount) {
        billStatus = 'paid';
      } else if (newTotalPaid > 0) {
        billStatus = 'partially_paid';
      }

      await tx.bill.update({
        where: { id: billId },
        data: { status: billStatus },
      });

      return payment;
    });

    // Invalidate related caches
    await deleteCache('bills:*');
    await deleteCache('payments:*');
    await deleteCache(`bill:${billId}`);
    
    await userActivityLogger(req, 'payment', 'create', { 
      paymentId: result.id,
      billId,
      amount,
      paymentMethod 
    });

    logger.info(`Payment created: ${result.id}`, {
      userId: req.user?.id,
      paymentId: result.id,
      billId,
      amount,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Payment processed successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Error creating payment:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing payment',
      });
    }
  }
};

export const refundPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { refundAmount, reason } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { bill: true },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    if (payment.status !== 'completed') {
      throw new AppError('Can only refund completed payments', 400);
    }

    if (refundAmount > payment.amount) {
      throw new AppError('Refund amount cannot exceed payment amount', 400);
    }

    // Create refund payment record
    const refund = await prisma.payment.create({
      data: {
        billId: payment.billId,
        amount: -refundAmount,
        paymentMethod: payment.paymentMethod,
        paymentDate: new Date(),
        status: 'refunded',
        notes: `Refund for payment ${payment.id}. Reason: ${reason}`,
      },
    });

    logger.info(`Payment refunded: ${id}`, {
      userId: req.user?.id,
      originalPaymentId: id,
      refundPaymentId: refund.id,
      refundAmount,
    });

    res.json({
      success: true,
      data: refund,
      message: 'Payment refunded successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Error refunding payment:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing refund',
      });
    }
  }
};

// Financial Reports
export const getFinancialReports = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, reportType = 'summary' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    if (reportType === 'summary') {
      // Revenue summary
      const revenueData = await prisma.payment.aggregate({
        where: {
          status: 'completed',
          paymentDate: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      // Outstanding bills
      const outstandingBills = await prisma.bill.aggregate({
        where: {
          status: {
            in: ['pending', 'partially_paid'],
          },
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      });

      // Payment methods breakdown
      const paymentMethods = await prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          status: 'completed',
          paymentDate: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      // Daily revenue trend
      const dailyRevenue = await prisma.$queryRaw`
        SELECT 
          DATE(payment_date) as date,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM payments 
        WHERE status = 'completed' 
          AND payment_date >= ${start}
          AND payment_date <= ${end}
        GROUP BY DATE(payment_date)
        ORDER BY date
      `;

      res.json({
        success: true,
        data: {
          summary: {
            totalRevenue: revenueData._sum.amount || 0,
            totalTransactions: revenueData._count,
            outstandingAmount: outstandingBills._sum.totalAmount || 0,
            outstandingBills: outstandingBills._count,
          },
          paymentMethods,
          dailyRevenue,
        },
      });
    } else if (reportType === 'detailed') {
      // Detailed financial report
      const bills = await prisma.bill.findMany({
        where: {
          billDate: {
            gte: start,
            lte: end,
          },
        },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              patientNumber: true,
            },
          },
          payments: {
            where: { status: 'completed' },
          },
          billItems: true,
        },
        orderBy: { billDate: 'desc' },
      });

      res.json({
        success: true,
        data: { bills },
      });
    }
  } catch (error) {
    logger.error('Error generating financial reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating financial reports',
    });
  }
};

export const getRevenueAnalytics = async (req: Request, res: Response) => {
  try {
    const { period = 'monthly' } = req.query;

    let groupBy = '';
    let dateFormat = '';

    switch (period) {
      case 'daily':
        groupBy = 'DATE(payment_date)';
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        groupBy = 'YEARWEEK(payment_date)';
        dateFormat = '%Y-W%u';
        break;
      case 'monthly':
        groupBy = 'DATE_FORMAT(payment_date, "%Y-%m")';
        dateFormat = '%Y-%m';
        break;
      case 'yearly':
        groupBy = 'YEAR(payment_date)';
        dateFormat = '%Y';
        break;
      default:
        groupBy = 'DATE_FORMAT(payment_date, "%Y-%m")';
        dateFormat = '%Y-%m';
    }

    const revenueAnalytics = await prisma.$queryRaw`
      SELECT 
        ${groupBy} as period,
        SUM(amount) as revenue,
        COUNT(*) as transactions,
        AVG(amount) as avg_transaction
      FROM payments 
      WHERE status = 'completed'
        AND payment_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY ${groupBy}
      ORDER BY period DESC
      LIMIT 12
    `;

    // Department-wise revenue
    const departmentRevenue = await prisma.$queryRaw`
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
        AND p.payment_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
      GROUP BY d.id, d.name
      ORDER BY revenue DESC
    `;

    res.json({
      success: true,
      data: {
        revenueAnalytics,
        departmentRevenue,
      },
    });
  } catch (error) {
    logger.error('Error generating revenue analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating revenue analytics',
    });
  }
};

export const getOutstandingPayments = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, sortBy = 'amount', sortOrder = 'desc' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get bills with outstanding amounts
    const outstandingBills = await prisma.$queryRaw`
      SELECT 
        b.id,
        b.bill_number,
        b.total_amount,
        b.bill_date,
        COALESCE(SUM(p.amount), 0) as paid_amount,
        (b.total_amount - COALESCE(SUM(p.amount), 0)) as outstanding_amount,
        pt.first_name,
        pt.last_name,
        pt.patient_number,
        pt.phone,
        DATEDIFF(NOW(), b.bill_date) as days_overdue
      FROM bills b
      LEFT JOIN payments p ON b.id = p.bill_id AND p.status = 'completed'
      JOIN patients pt ON b.patient_id = pt.id
      WHERE b.status IN ('pending', 'partially_paid')
      GROUP BY b.id
      HAVING outstanding_amount > 0
      ORDER BY ${sortBy === 'amount' ? 'outstanding_amount' : 'days_overdue'} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;

    const totalOutstanding = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_bills,
        SUM(b.total_amount - COALESCE(paid.amount, 0)) as total_outstanding
      FROM bills b
      LEFT JOIN (
        SELECT bill_id, SUM(amount) as amount
        FROM payments 
        WHERE status = 'completed'
        GROUP BY bill_id
      ) paid ON b.id = paid.bill_id
      WHERE b.status IN ('pending', 'partially_paid')
      AND (b.total_amount - COALESCE(paid.amount, 0)) > 0
    `;

    res.json({
      success: true,
      data: {
        outstandingBills,
        summary: totalOutstanding[0],
        pagination: {
          page: Number(page),
          limit: Number(limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching outstanding payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching outstanding payments',
    });
  }
};