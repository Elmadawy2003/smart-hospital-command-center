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

// Billing Management
export const getBillings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const patientId = req.query.patientId as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';

    // Build where clause
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (patientId) {
      where.patientId = patientId;
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    const startTime = performance.now();
    
    const [billings, totalCount] = await Promise.all([
      prisma.billing.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              mrn: true,
              phone: true,
              email: true,
            }
          },
          appointment: {
            select: {
              appointmentDate: true,
              type: true,
              doctor: {
                select: {
                  firstName: true,
                  lastName: true,
                  specialization: true,
                }
              }
            }
          },
          items: {
            include: {
              service: {
                select: {
                  name: true,
                  code: true,
                  category: true,
                }
              }
            }
          },
          payments: {
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.billing.count({ where })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Billing list query', [], endTime - startTime);

    const totalPages = Math.ceil(totalCount / limit);

    // Calculate summary statistics
    const billingStats = billings.reduce((acc, billing) => {
      acc.totalAmount += billing.totalAmount;
      acc.paidAmount += billing.paidAmount;
      acc.pendingAmount += (billing.totalAmount - billing.paidAmount);
      return acc;
    }, { totalAmount: 0, paidAmount: 0, pendingAmount: 0 });

    res.json({
      success: true,
      data: {
        billings: billings.map(billing => ({
          ...billing,
          balanceAmount: billing.totalAmount - billing.paidAmount,
          paymentHistory: billing.payments,
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        summary: billingStats,
      },
      message: `Retrieved ${billings.length} billing records successfully`
    });

  } catch (error) {
    logger.error('Error fetching billings:', error);
    throw new AppError('Failed to fetch billing records', 500);
  }
};

export const getBillingById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check cache first
    const cacheKey = `billing:${id}`;
    const cachedBilling = await getCache(cacheKey);
    
    if (cachedBilling) {
      return res.json({
        success: true,
        data: JSON.parse(cachedBilling),
        message: 'Billing record retrieved successfully (cached)'
      });
    }

    const startTime = performance.now();
    
    const billing = await prisma.billing.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
            phone: true,
            email: true,
            address: true,
            insuranceInfo: true,
          }
        },
        appointment: {
          select: {
            appointmentDate: true,
            type: true,
            duration: true,
            doctor: {
              select: {
                firstName: true,
                lastName: true,
                specialization: true,
                department: {
                  select: { name: true }
                }
              }
            },
            department: {
              select: { name: true }
            }
          }
        },
        items: {
          include: {
            service: {
              select: {
                name: true,
                code: true,
                category: true,
                description: true,
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdByUser: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          }
        }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Billing detail query', [id], endTime - startTime);

    if (!billing) {
      throw new AppError('Billing record not found', 404);
    }

    // Calculate additional fields
    const billingWithCalculations = {
      ...billing,
      balanceAmount: billing.totalAmount - billing.paidAmount,
      isFullyPaid: billing.totalAmount === billing.paidAmount,
      isOverdue: billing.dueDate && new Date() > billing.dueDate && billing.status !== 'paid',
      daysPastDue: billing.dueDate ? Math.max(0, Math.floor((Date.now() - billing.dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0,
    };

    // Cache the result for 10 minutes
    await setCache(cacheKey, JSON.stringify(billingWithCalculations), 600);

    res.json({
      success: true,
      data: billingWithCalculations,
      message: 'Billing record retrieved successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching billing record:', error);
    throw new AppError('Failed to fetch billing record', 500);
  }
};

export const createBilling = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      patientId,
      appointmentId,
      items,
      discountAmount = 0,
      taxAmount = 0,
      notes,
      dueDate,
      insuranceClaim,
    } = req.body;

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    // Verify appointment exists if provided
    if (appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId }
      });

      if (!appointment) {
        throw new AppError('Appointment not found', 404);
      }
    }

    // Validate and calculate totals
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('At least one billing item is required', 400);
    }

    // Verify all services exist
    const serviceIds = items.map(item => item.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } }
    });

    if (services.length !== serviceIds.length) {
      throw new AppError('One or more services not found', 404);
    }

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => {
      const service = services.find(s => s.id === item.serviceId);
      const unitPrice = item.unitPrice || service?.price || 0;
      return sum + (unitPrice * item.quantity);
    }, 0);

    const totalAmount = subtotal - discountAmount + taxAmount;

    if (totalAmount < 0) {
      throw new AppError('Total amount cannot be negative', 400);
    }

    const startTime = performance.now();
    
    // Create billing record with items in a transaction
    const billing = await prisma.$transaction(async (tx) => {
      // Create the billing record
      const newBilling = await tx.billing.create({
        data: {
          patientId,
          appointmentId,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          status: 'pending',
          notes,
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
          insuranceClaim,
          createdBy: req.user!.id,
        }
      });

      // Create billing items
      const billingItems = await Promise.all(
        items.map(item => {
          const service = services.find(s => s.id === item.serviceId);
          const unitPrice = item.unitPrice || service?.price || 0;
          
          return tx.billingItem.create({
            data: {
              billingId: newBilling.id,
              serviceId: item.serviceId,
              quantity: item.quantity,
              unitPrice,
              totalPrice: unitPrice * item.quantity,
              description: item.description,
            }
          });
        })
      );

      return { ...newBilling, items: billingItems };
    });

    const endTime = performance.now();
    dbQueryLogger('Billing creation', [billing.id], endTime - startTime);

    // Fetch the complete billing record with relations
    const completeBilling = await prisma.billing.findUnique({
      where: { id: billing.id },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          }
        },
        items: {
          include: {
            service: {
              select: {
                name: true,
                code: true,
                category: true,
              }
            }
          }
        }
      }
    });

    // Log user activity
    logger.info('Billing record created', {
      billingId: billing.id,
      patientId,
      totalAmount,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: completeBilling,
      message: 'Billing record created successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error creating billing record:', error);
    throw new AppError('Failed to create billing record', 500);
  }
};

export const updateBilling = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.createdBy;
    delete updateData.paidAmount; // This should only be updated through payments

    // Check if billing exists
    const existingBilling = await prisma.billing.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
      }
    });

    if (!existingBilling) {
      throw new AppError('Billing record not found', 404);
    }

    // Check if billing can be updated (not if it's paid)
    if (existingBilling.status === 'paid') {
      throw new AppError('Cannot update a fully paid billing record', 400);
    }

    const startTime = performance.now();
    
    const updatedBilling = await prisma.billing.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          }
        },
        items: {
          include: {
            service: {
              select: {
                name: true,
                code: true,
                category: true,
              }
            }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Billing update', [id], endTime - startTime);

    // Clear cache
    await deleteCache(`billing:${id}`);

    // Log user activity
    logger.info('Billing record updated', {
      billingId: id,
      updatedBy: req.user!.id,
      changes: Object.keys(updateData),
    });

    res.json({
      success: true,
      data: updatedBilling,
      message: 'Billing record updated successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error updating billing record:', error);
    throw new AppError('Failed to update billing record', 500);
  }
};

// Payment Management
export const createPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      billingId,
      amount,
      paymentMethod,
      transactionId,
      notes,
      paymentDate,
    } = req.body;

    // Verify billing exists and get current status
    const billing = await prisma.billing.findUnique({
      where: { id: billingId },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          }
        }
      }
    });

    if (!billing) {
      throw new AppError('Billing record not found', 404);
    }

    const remainingAmount = billing.totalAmount - billing.paidAmount;
    
    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    if (amount > remainingAmount) {
      throw new AppError(`Payment amount cannot exceed remaining balance of $${remainingAmount.toFixed(2)}`, 400);
    }

    const startTime = performance.now();
    
    // Create payment and update billing in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the payment record
      const payment = await tx.payment.create({
        data: {
          billingId,
          amount,
          paymentMethod,
          transactionId,
          notes,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          createdBy: req.user!.id,
        }
      });

      // Update billing paid amount and status
      const newPaidAmount = billing.paidAmount + amount;
      const newStatus = newPaidAmount >= billing.totalAmount ? 'paid' : 
                       newPaidAmount > 0 ? 'partial' : 'pending';

      const updatedBilling = await tx.billing.update({
        where: { id: billingId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date(),
        }
      });

      return { payment, updatedBilling };
    });

    const endTime = performance.now();
    dbQueryLogger('Payment creation', [result.payment.id], endTime - startTime);

    // Clear billing cache
    await deleteCache(`billing:${billingId}`);

    // Log user activity
    logger.info('Payment recorded', {
      paymentId: result.payment.id,
      billingId,
      amount,
      paymentMethod,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: {
        payment: result.payment,
        billing: result.updatedBilling,
        remainingBalance: billing.totalAmount - result.updatedBilling.paidAmount,
      },
      message: 'Payment recorded successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error creating payment:', error);
    throw new AppError('Failed to record payment', 500);
  }
};

export const getPayments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const billingId = req.query.billingId as string;
    const patientId = req.query.patientId as string;
    const paymentMethod = req.query.paymentMethod as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    // Build where clause
    const where: any = {};
    
    if (billingId) {
      where.billingId = billingId;
    }
    
    if (patientId) {
      where.billing = { patientId };
    }
    
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }
    
    if (dateFrom || dateTo) {
      where.paymentDate = {};
      if (dateFrom) {
        where.paymentDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.paymentDate.lte = new Date(dateTo);
      }
    }

    const startTime = performance.now();
    
    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          billing: {
            select: {
              id: true,
              totalAmount: true,
              patient: {
                select: {
                  firstName: true,
                  lastName: true,
                  mrn: true,
                }
              }
            }
          },
          createdByUser: {
            select: {
              firstName: true,
              lastName: true,
            }
          }
        }
      }),
      prisma.payment.count({ where })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Payments query', [], endTime - startTime);

    const totalPages = Math.ceil(totalCount / limit);

    // Calculate summary statistics
    const paymentStats = payments.reduce((acc, payment) => {
      acc.totalAmount += payment.amount;
      acc.count += 1;
      return acc;
    }, { totalAmount: 0, count: 0 });

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        summary: paymentStats,
      },
      message: `Retrieved ${payments.length} payment records successfully`
    });

  } catch (error) {
    logger.error('Error fetching payments:', error);
    throw new AppError('Failed to fetch payment records', 500);
  }
};

// Reports and Analytics
export const getBillingStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const departmentId = req.query.departmentId as string;

    // Build date filter
    const dateFilter: any = {};
    if (dateFrom || dateTo) {
      if (dateFrom) {
        dateFilter.gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.lte = new Date(dateTo);
      }
    } else {
      // Default to current month
      const now = new Date();
      dateFilter.gte = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.lte = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const where: any = {
      createdAt: dateFilter
    };

    if (departmentId) {
      where.appointment = { departmentId };
    }

    const startTime = performance.now();
    
    const [
      totalBillings,
      totalRevenue,
      totalPaid,
      pendingAmount,
      overdueAmount,
      statusBreakdown,
      paymentMethodBreakdown,
      dailyRevenue,
    ] = await Promise.all([
      // Total billings count
      prisma.billing.count({ where }),
      
      // Total revenue (sum of all billing amounts)
      prisma.billing.aggregate({
        where,
        _sum: { totalAmount: true }
      }),
      
      // Total paid amount
      prisma.billing.aggregate({
        where,
        _sum: { paidAmount: true }
      }),
      
      // Pending amount
      prisma.billing.aggregate({
        where: {
          ...where,
          status: { in: ['pending', 'partial'] }
        },
        _sum: { totalAmount: true }
      }),
      
      // Overdue amount
      prisma.billing.aggregate({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { in: ['pending', 'partial'] }
        },
        _sum: { totalAmount: true }
      }),
      
      // Status breakdown
      prisma.billing.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
        _sum: { totalAmount: true }
      }),
      
      // Payment method breakdown
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          paymentDate: dateFilter
        },
        _count: { paymentMethod: true },
        _sum: { amount: true }
      }),
      
      // Daily revenue for the period
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as billing_count,
          SUM(total_amount) as total_amount,
          SUM(paid_amount) as paid_amount
        FROM billings 
        WHERE created_at >= ${dateFilter.gte} 
          AND created_at <= ${dateFilter.lte}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `
    ]);

    const endTime = performance.now();
    dbQueryLogger('Billing statistics', [], endTime - startTime);

    const stats = {
      overview: {
        totalBillings,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        totalPaid: totalPaid._sum.paidAmount || 0,
        pendingAmount: (pendingAmount._sum.totalAmount || 0) - (totalPaid._sum.paidAmount || 0),
        overdueAmount: overdueAmount._sum.totalAmount || 0,
        collectionRate: totalRevenue._sum.totalAmount ? 
          ((totalPaid._sum.paidAmount || 0) / totalRevenue._sum.totalAmount * 100).toFixed(2) : '0.00',
      },
      statusBreakdown: statusBreakdown.map(item => ({
        status: item.status,
        count: item._count.status,
        amount: item._sum.totalAmount || 0,
      })),
      paymentMethodBreakdown: paymentMethodBreakdown.map(item => ({
        method: item.paymentMethod,
        count: item._count.paymentMethod,
        amount: item._sum.amount || 0,
      })),
      dailyRevenue: dailyRevenue,
    };

    res.json({
      success: true,
      data: stats,
      message: 'Billing statistics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching billing statistics:', error);
    throw new AppError('Failed to fetch billing statistics', 500);
  }
};

export const getOutstandingBillings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const overdueOnly = req.query.overdueOnly === 'true';

    const where: any = {
      status: { in: ['pending', 'partial'] }
    };

    if (overdueOnly) {
      where.dueDate = { lt: new Date() };
    }

    const startTime = performance.now();
    
    const [outstandingBillings, totalCount] = await Promise.all([
      prisma.billing.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              mrn: true,
              phone: true,
              email: true,
            }
          },
          appointment: {
            select: {
              appointmentDate: true,
              doctor: {
                select: {
                  firstName: true,
                  lastName: true,
                }
              }
            }
          }
        }
      }),
      prisma.billing.count({ where })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Outstanding billings query', [], endTime - startTime);

    const totalPages = Math.ceil(totalCount / limit);

    // Add calculated fields
    const billingsWithCalculations = outstandingBillings.map(billing => ({
      ...billing,
      outstandingAmount: billing.totalAmount - billing.paidAmount,
      isOverdue: billing.dueDate && new Date() > billing.dueDate,
      daysPastDue: billing.dueDate ? Math.max(0, Math.floor((Date.now() - billing.dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0,
    }));

    res.json({
      success: true,
      data: {
        billings: billingsWithCalculations,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      },
      message: `Retrieved ${outstandingBillings.length} outstanding billing records`
    });

  } catch (error) {
    logger.error('Error fetching outstanding billings:', error);
    throw new AppError('Failed to fetch outstanding billings', 500);
  }
};

// Service Management
export const getServices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const category = req.query.category as string;
    const search = req.query.search as string;
    const isActive = req.query.isActive !== 'false';

    // Build where clause
    const where: any = { isActive };
    
    if (category) {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const startTime = performance.now();
    
    const [services, totalCount] = await Promise.all([
      prisma.service.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ]
      }),
      prisma.service.count({ where })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Services query', [], endTime - startTime);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        services,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      },
      message: `Retrieved ${services.length} services successfully`
    });

  } catch (error) {
    logger.error('Error fetching services:', error);
    throw new AppError('Failed to fetch services', 500);
  }
};

export const createService = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      code,
      description,
      category,
      price,
      departmentId,
      isActive = true,
    } = req.body;

    // Check for duplicate code
    const existingService = await prisma.service.findUnique({
      where: { code }
    });

    if (existingService) {
      throw new AppError('Service with this code already exists', 409);
    }

    const startTime = performance.now();
    
    const service = await prisma.service.create({
      data: {
        name,
        code,
        description,
        category,
        price,
        departmentId,
        isActive,
        createdBy: req.user!.id,
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Service creation', [service.id], endTime - startTime);

    // Log user activity
    logger.info('Service created', {
      serviceId: service.id,
      serviceName: name,
      serviceCode: code,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: service,
      message: 'Service created successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error creating service:', error);
    throw new AppError('Failed to create service', 500);
  }
};

// Insurance Management Functions
export const getInsuranceProviders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cacheKey = 'billing:insurance_providers';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'insurance_providers_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Insurance providers retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();
    
    // This would typically come from a separate insurance providers table
    // For now, we'll simulate it with aggregated data from bills
    const insuranceData = await prisma.bill.groupBy({
      by: ['insuranceProvider'],
      where: {
        insuranceProvider: { not: null }
      },
      _count: { id: true },
      _sum: { 
        totalAmount: true,
        insuranceCoverage: true 
      },
      orderBy: {
        _count: { id: 'desc' }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Insurance providers query', [], endTime - startTime);

    await setCache(cacheKey, insuranceData, 3600); // Cache for 1 hour

    userActivityLogger(req.user?.id || 'unknown', 'insurance_providers_view', { 
      providersCount: insuranceData.length 
    });

    res.json({
      success: true,
      data: insuranceData,
      message: 'Insurance providers retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching insurance providers:', error);
    throw new AppError('Failed to fetch insurance providers', 500);
  }
};

// Insurance Claim Processing
export const processInsuranceClaim = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { billId, claimAmount, claimDetails } = req.body;
    
    if (!billId || !claimAmount) {
      throw new AppError('Bill ID and claim amount are required', 400);
    }

    const startTime = performance.now();
    
    // Get the bill with patient and insurance details
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            insuranceNumber: true,
            insuranceProvider: true
          }
        },
        billItems: true
      }
    });

    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    if (!bill.patient.insuranceProvider) {
      throw new AppError('Patient does not have insurance coverage', 400);
    }

    // Process the insurance claim (in real implementation, this would integrate with insurance APIs)
    const claimResult = await prisma.$transaction(async (tx) => {
      // Update bill with insurance claim information
      const updatedBill = await tx.bill.update({
        where: { id: billId },
        data: {
          insuranceClaimed: true,
          insuranceClaimAmount: claimAmount,
          insuranceClaimDate: new Date(),
          insuranceClaimStatus: 'pending',
          insuranceClaimDetails: claimDetails || {},
          updatedAt: new Date()
        }
      });

      // Create audit log for insurance claim
      await tx.auditLog.create({
        data: {
          userId: req.user?.id || 'system',
          action: 'insurance_claim_processed',
          tableName: 'Bill',
          recordId: billId,
          changes: {
            claimAmount,
            claimDetails,
            status: 'pending'
          }
        }
      });

      return updatedBill;
    });

    const endTime = performance.now();
    dbQueryLogger('Insurance claim processing', [billId], endTime - startTime);

    // Clear related caches
    await deleteCache(`billing:${billId}`);
    await deleteCache('billing:*');

    userActivityLogger(req.user?.id || 'unknown', 'insurance_claim_processed', { 
      billId,
      claimAmount,
      patientId: bill.patient.id
    });

    res.json({
      success: true,
      data: claimResult,
      message: 'Insurance claim processed successfully'
    });

  } catch (error) {
    logger.error('Error processing insurance claim:', error);
    throw new AppError('Failed to process insurance claim', 500);
  }
};

// Advanced Billing Analytics
export const getBillingAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, department } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const cacheKey = `billing:analytics:${start.toISOString()}:${end.toISOString()}:${department || 'all'}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'billing_analytics_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Billing analytics retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();
    
    const whereClause: any = {
      createdAt: { gte: start, lte: end }
    };

    if (department) {
      whereClause.appointment = {
        doctor: {
          department: department as string
        }
      };
    }

    const [
      totalBills,
      totalRevenue,
      paidBills,
      pendingBills,
      insuranceClaims,
      averageBillAmount,
      topServices,
      paymentMethods,
      departmentRevenue
    ] = await Promise.all([
      prisma.bill.count({ where: whereClause }),
      prisma.bill.aggregate({
        where: whereClause,
        _sum: { totalAmount: true }
      }),
      prisma.bill.count({
        where: { ...whereClause, status: 'paid' }
      }),
      prisma.bill.count({
        where: { ...whereClause, status: 'pending' }
      }),
      prisma.bill.aggregate({
        where: { 
          ...whereClause, 
          insuranceClaimed: true 
        },
        _sum: { insuranceClaimAmount: true },
        _count: { id: true }
      }),
      prisma.bill.aggregate({
        where: whereClause,
        _avg: { totalAmount: true }
      }),
      prisma.billItem.groupBy({
        by: ['serviceName'],
        where: {
          bill: whereClause
        },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10
      }),
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          bill: whereClause
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.bill.groupBy({
        by: ['appointment', 'doctor', 'department'],
        where: whereClause,
        _sum: { totalAmount: true },
        _count: { id: true }
      })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Billing analytics query', [start, end, department], endTime - startTime);

    const analyticsData = {
      summary: {
        totalBills,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        paidBills,
        pendingBills,
        collectionRate: totalBills > 0 ? (paidBills / totalBills * 100).toFixed(2) : 0,
        averageBillAmount: averageBillAmount._avg.totalAmount || 0,
        insuranceClaims: {
          count: insuranceClaims._count.id || 0,
          amount: insuranceClaims._sum.insuranceClaimAmount || 0
        }
      },
      topServices,
      paymentMethods,
      departmentRevenue,
      period: { startDate: start, endDate: end }
    };

    await setCache(cacheKey, analyticsData, 1800); // Cache for 30 minutes

    userActivityLogger(req.user?.id || 'unknown', 'billing_analytics_view', { 
      period: `${start.toISOString()} to ${end.toISOString()}`,
      totalBills,
      revenue: analyticsData.summary.totalRevenue
    });

    res.json({
      success: true,
      data: analyticsData,
      message: 'Billing analytics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching billing analytics:', error);
    throw new AppError('Failed to fetch billing analytics', 500);
  }
};

// Payment Plan Management
export const createPaymentPlan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { billId, installments, startDate, monthlyAmount } = req.body;
    
    if (!billId || !installments || !monthlyAmount) {
      throw new AppError('Bill ID, installments, and monthly amount are required', 400);
    }

    const startTime = performance.now();
    
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { patient: true }
    });

    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    if (bill.status === 'paid') {
      throw new AppError('Cannot create payment plan for paid bill', 400);
    }

    const paymentPlan = await prisma.$transaction(async (tx) => {
      // Update bill status to payment plan
      await tx.bill.update({
        where: { id: billId },
        data: {
          status: 'payment_plan',
          updatedAt: new Date()
        }
      });

      // Create payment plan record (this would be in a separate PaymentPlan table in real implementation)
      const planDetails = {
        billId,
        totalAmount: bill.totalAmount,
        installments,
        monthlyAmount,
        startDate: startDate ? new Date(startDate) : new Date(),
        remainingAmount: bill.totalAmount,
        status: 'active'
      };

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id || 'system',
          action: 'payment_plan_created',
          tableName: 'Bill',
          recordId: billId,
          changes: planDetails
        }
      });

      return planDetails;
    });

    const endTime = performance.now();
    dbQueryLogger('Payment plan creation', [billId], endTime - startTime);

    // Clear related caches
    await deleteCache(`billing:${billId}`);
    await deleteCache('billing:*');

    userActivityLogger(req.user?.id || 'unknown', 'payment_plan_created', { 
      billId,
      installments,
      monthlyAmount,
      patientId: bill.patient.id
    });

    res.json({
      success: true,
      data: paymentPlan,
      message: 'Payment plan created successfully'
    });

  } catch (error) {
    logger.error('Error creating payment plan:', error);
    throw new AppError('Failed to create payment plan', 500);
  }
};

// Billing Reconciliation
export const reconcileBilling = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const startTime = performance.now();
    
    // Get all bills and payments for the period
    const [bills, payments] = await Promise.all([
      prisma.bill.findMany({
        where: {
          createdAt: { gte: start, lte: end }
        },
        include: {
          payments: true,
          billItems: true
        }
      }),
      prisma.payment.findMany({
        where: {
          paymentDate: { gte: start, lte: end }
        },
        include: {
          bill: true
        }
      })
    ]);

    // Perform reconciliation checks
    const reconciliationResults = {
      totalBills: bills.length,
      totalPayments: payments.length,
      discrepancies: [] as any[],
      summary: {
        billedAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        overpaidAmount: 0
      }
    };

    bills.forEach(bill => {
      const billPayments = bill.payments;
      const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount, 0);
      
      reconciliationResults.summary.billedAmount += bill.totalAmount;
      reconciliationResults.summary.paidAmount += totalPaid;

      if (totalPaid < bill.totalAmount) {
        reconciliationResults.summary.outstandingAmount += (bill.totalAmount - totalPaid);
      } else if (totalPaid > bill.totalAmount) {
        reconciliationResults.summary.overpaidAmount += (totalPaid - bill.totalAmount);
        reconciliationResults.discrepancies.push({
          type: 'overpayment',
          billId: bill.id,
          billedAmount: bill.totalAmount,
          paidAmount: totalPaid,
          difference: totalPaid - bill.totalAmount
        });
      }

      // Check for billing item discrepancies
      const itemsTotal = bill.billItems.reduce((sum, item) => sum + item.amount, 0);
      if (Math.abs(itemsTotal - bill.totalAmount) > 0.01) {
        reconciliationResults.discrepancies.push({
          type: 'billing_mismatch',
          billId: bill.id,
          billTotal: bill.totalAmount,
          itemsTotal,
          difference: bill.totalAmount - itemsTotal
        });
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Billing reconciliation', [start, end], endTime - startTime);

    userActivityLogger(req.user?.id || 'unknown', 'billing_reconciliation', { 
      period: `${start.toISOString()} to ${end.toISOString()}`,
      billsProcessed: bills.length,
      discrepanciesFound: reconciliationResults.discrepancies.length
    });

    res.json({
      success: true,
      data: reconciliationResults,
      message: 'Billing reconciliation completed successfully'
    });

  } catch (error) {
    logger.error('Error in billing reconciliation:', error);
    throw new AppError('Failed to perform billing reconciliation', 500);
  }
};

// Automated Billing Generation
export const generateAutomatedBilling = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { appointmentIds, serviceTemplateId } = req.body;
    
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      throw new AppError('Appointment IDs are required', 400);
    }

    const startTime = performance.now();
    
    const generatedBills = await prisma.$transaction(async (tx) => {
      const bills = [];
      
      for (const appointmentId of appointmentIds) {
        const appointment = await tx.appointment.findUnique({
          where: { id: appointmentId },
          include: {
            patient: true,
            doctor: {
              include: { department: true }
            }
          }
        });

        if (!appointment) {
          continue;
        }

        // Check if bill already exists for this appointment
        const existingBill = await tx.bill.findFirst({
          where: { appointmentId }
        });

        if (existingBill) {
          continue;
        }

        // Generate bill items based on appointment type and department
        const billItems = [];
        let totalAmount = 0;

        // Consultation fee
        const consultationFee = appointment.doctor.department?.name === 'Cardiology' ? 200 : 150;
        billItems.push({
          serviceName: 'Consultation',
          description: `${appointment.doctor.department?.name} consultation`,
          quantity: 1,
          unitPrice: consultationFee,
          amount: consultationFee
        });
        totalAmount += consultationFee;

        // Additional services based on appointment type
        if (appointment.type === 'follow_up') {
          const followUpFee = 75;
          billItems.push({
            serviceName: 'Follow-up',
            description: 'Follow-up consultation',
            quantity: 1,
            unitPrice: followUpFee,
            amount: followUpFee
          });
          totalAmount += followUpFee;
        }

        // Calculate insurance coverage if applicable
        let insuranceCoverage = 0;
        if (appointment.patient.insuranceProvider) {
          insuranceCoverage = totalAmount * 0.8; // 80% coverage
        }

        const finalAmount = totalAmount - insuranceCoverage;

        // Create the bill
        const bill = await tx.bill.create({
          data: {
            patientId: appointment.patient.id,
            appointmentId: appointment.id,
            totalAmount: finalAmount,
            insuranceCoverage,
            insuranceProvider: appointment.patient.insuranceProvider,
            status: 'pending',
            billItems: {
              create: billItems
            }
          },
          include: {
            billItems: true,
            patient: true
          }
        });

        bills.push(bill);
      }

      return bills;
    });

    const endTime = performance.now();
    dbQueryLogger('Automated billing generation', [appointmentIds.length], endTime - startTime);

    // Clear related caches
    await deleteCache('billing:*');

    userActivityLogger(req.user?.id || 'unknown', 'automated_billing_generated', { 
      appointmentsProcessed: appointmentIds.length,
      billsGenerated: generatedBills.length
    });

    res.json({
      success: true,
      data: {
        generatedBills,
        summary: {
          appointmentsProcessed: appointmentIds.length,
          billsGenerated: generatedBills.length,
          totalAmount: generatedBills.reduce((sum, bill) => sum + bill.totalAmount, 0)
        }
      },
      message: `Successfully generated ${generatedBills.length} bills`
    });

  } catch (error) {
    logger.error('Error generating automated billing:', error);
    throw new AppError('Failed to generate automated billing', 500);
  }
};