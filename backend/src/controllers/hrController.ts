import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { dbQueryLogger, userActivityLogger } from '@/middleware/logging';
import { setCache, getCache, deleteCache } from '@/config/redis';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Employee Management
export const getEmployees = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { page = 1, limit = 10, search, department, role, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Create cache key
    const cacheKey = `employees:${page}:${limit}:${search || ''}:${department || ''}:${role || ''}:${status || ''}`;
    
    // Try to get from cache
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      userActivityLogger.info('Employees fetched from cache', {
        userId: req.user?.id,
        action: 'get_employees',
        cached: true,
        duration: Date.now() - startTime
      });
      
      return res.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { employeeId: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (department) {
      where.departmentId = department;
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.isActive = status === 'active';
    }

    const queryStart = Date.now();
    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          employeeId: true,
          isActive: true,
          createdAt: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip: offset,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    dbQueryLogger.info('Employee query executed', {
      query: 'getEmployees',
      duration: Date.now() - queryStart,
      resultCount: employees.length,
      totalCount: total
    });

    const responseData = {
      employees,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };

    // Cache the result for 5 minutes
    await setCache(cacheKey, responseData, 300);

    userActivityLogger.info('Employees fetched successfully', {
      userId: req.user?.id,
      action: 'get_employees',
      resultCount: employees.length,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('Error fetching employees:', error);
    throw new AppError('Failed to fetch employees', 500);
  }
};

export const getEmployeeById = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const cacheKey = `employee:${id}`;

    // Try to get from cache
    const cachedEmployee = await getCache(cacheKey);
    if (cachedEmployee) {
      userActivityLogger.info('Employee fetched from cache', {
        userId: req.user?.id,
        action: 'get_employee_by_id',
        employeeId: id,
        cached: true,
        duration: Date.now() - startTime
      });
      
      return res.json({
        success: true,
        data: cachedEmployee,
        cached: true
      });
    }

    const queryStart = Date.now();
    const employee = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        employeeId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        attendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        leaveRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        payroll: {
          orderBy: { payPeriodStart: 'desc' },
          take: 12,
        },
      },
    });

    dbQueryLogger.info('Employee by ID query executed', {
      query: 'getEmployeeById',
      employeeId: id,
      duration: Date.now() - queryStart,
      found: !!employee
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Cache the result for 10 minutes
    await setCache(cacheKey, employee, 600);

    userActivityLogger.info('Employee fetched successfully', {
      userId: req.user?.id,
      action: 'get_employee_by_id',
      employeeId: id,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    } else {
      logger.error('Error fetching employee:', error);
      throw new AppError('Failed to fetch employee', 500);
    }
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { firstName, lastName, email, phone, role, departmentId, password } = req.body;

    // Check if email already exists
    const queryStart = Date.now();
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    dbQueryLogger.info('Email existence check', {
      query: 'findUniqueUser',
      email,
      duration: Date.now() - queryStart,
      found: !!existingUser
    });

    if (existingUser) {
      throw new AppError('Email already exists', 400);
    }

    // Generate employee ID
    const lastEmployee = await prisma.user.findFirst({
      where: {
        employeeId: {
          not: null,
        },
      },
      orderBy: {
        employeeId: 'desc',
      },
    });

    let employeeId = 'EMP001';
    if (lastEmployee?.employeeId) {
      const lastNumber = parseInt(lastEmployee.employeeId.replace('EMP', ''));
      employeeId = `EMP${String(lastNumber + 1).padStart(3, '0')}`;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const createStart = Date.now();
    const employee = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        role,
        departmentId,
        employeeId,
        password: hashedPassword,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        employeeId: true,
        isActive: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    dbQueryLogger.info('Employee created', {
      query: 'createUser',
      employeeId: employee.id,
      duration: Date.now() - createStart
    });

    // Invalidate employees cache
    await deleteCache('employees:*');

    userActivityLogger.info('Employee created successfully', {
      userId: req.user?.id,
      action: 'create_employee',
      employeeId: employee.id,
      employeeEmail: email,
      duration: Date.now() - startTime
    });

    res.status(201).json({
      success: true,
      data: employee,
      message: 'Employee created successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    } else {
      logger.error('Error creating employee:', error);
      throw new AppError('Failed to create employee', 500);
    }
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
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

    // Remove password from update data if present
    delete updateData.password;

    const employee = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        employeeId: true,
        isActive: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Employee updated: ${id}`, {
      userId: req.user?.id,
      employeeId: id,
    });

    res.json({
      success: true,
      data: employee,
      message: 'Employee updated successfully',
    });
  } catch (error) {
    logger.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating employee',
    });
  }
};

export const deactivateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`Employee deactivated: ${id}`, {
      userId: req.user?.id,
      employeeId: id,
    });

    res.json({
      success: true,
      message: 'Employee deactivated successfully',
    });
  } catch (error) {
    logger.error('Error deactivating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating employee',
    });
  }
};

// Attendance Management
export const getAttendance = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, employeeId, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const [attendance, total] = await Promise.all([
      prisma.employeeAttendance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        skip: offset,
        take: Number(limit),
        orderBy: { date: 'desc' },
      }),
      prisma.employeeAttendance.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        attendance,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance',
    });
  }
};

export const markAttendance = async (req: Request, res: Response) => {
  try {
    const { employeeId, date, checkIn, checkOut, status } = req.body;

    // Check if attendance already exists for this date
    const existingAttendance = await prisma.employeeAttendance.findFirst({
      where: {
        employeeId,
        date: new Date(date),
      },
    });

    if (existingAttendance) {
      throw new AppError('Attendance already marked for this date', 400);
    }

    const attendance = await prisma.employeeAttendance.create({
      data: {
        employeeId,
        date: new Date(date),
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        status,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    });

    logger.info(`Attendance marked: ${attendance.id}`, {
      userId: req.user?.id,
      employeeId,
      date,
    });

    res.status(201).json({
      success: true,
      data: attendance,
      message: 'Attendance marked successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Error marking attendance:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking attendance',
      });
    }
  }
};

// Leave Management
export const getLeaveRequests = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, employeeId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const [leaveRequests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
          approvedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        skip: offset,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        leaveRequests,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching leave requests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leave requests',
    });
  }
};

export const createLeaveRequest = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { employeeId, leaveType, startDate, endDate, reason } = req.body;

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: 'pending',
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    });

    logger.info(`Leave request created: ${leaveRequest.id}`, {
      userId: req.user?.id,
      employeeId,
    });

    res.status(201).json({
      success: true,
      data: leaveRequest,
      message: 'Leave request created successfully',
    });
  } catch (error) {
    logger.error('Error creating leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating leave request',
    });
  }
};

export const approveLeaveRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;

    const leaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedById: req.user?.id,
        approvedDate: new Date(),
        comments,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    });

    logger.info(`Leave request ${status}: ${id}`, {
      userId: req.user?.id,
      leaveRequestId: id,
    });

    res.json({
      success: true,
      data: leaveRequest,
      message: `Leave request ${status} successfully`,
    });
  } catch (error) {
    logger.error('Error updating leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating leave request',
    });
  }
};

// Payroll Management
export const getPayroll = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, employeeId, year, month } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (year && month) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      
      where.payPeriodStart = {
        gte: startDate,
        lte: endDate,
      };
    }

    const [payroll, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        skip: offset,
        take: Number(limit),
        orderBy: { payPeriodStart: 'desc' },
      }),
      prisma.payroll.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        payroll,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payroll',
    });
  }
};

export const generatePayroll = async (req: Request, res: Response) => {
  try {
    const { employeeId, payPeriodStart, payPeriodEnd, basicSalary, allowances, deductions } = req.body;

    const grossSalary = basicSalary + (allowances || 0);
    const netSalary = grossSalary - (deductions || 0);

    const payroll = await prisma.payroll.create({
      data: {
        employeeId,
        payPeriodStart: new Date(payPeriodStart),
        payPeriodEnd: new Date(payPeriodEnd),
        basicSalary,
        allowances,
        deductions,
        grossSalary,
        netSalary,
        status: 'pending',
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    });

    logger.info(`Payroll generated: ${payroll.id}`, {
      userId: req.user?.id,
      employeeId,
    });

    res.status(201).json({
      success: true,
      data: payroll,
      message: 'Payroll generated successfully',
    });
  } catch (error) {
    logger.error('Error generating payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating payroll',
    });
  }
};

// HR Reports
export const getHRReports = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Total employees
    const totalEmployees = await prisma.user.count({
      where: { isActive: true },
    });

    // Active employees by department
    const employeesByDepartment = await prisma.user.groupBy({
      by: ['departmentId'],
      where: { isActive: true },
      _count: {
        id: true,
      },
    });

    // Attendance statistics
    const attendanceStats = await prisma.employeeAttendance.groupBy({
      by: ['status'],
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      _count: {
        id: true,
      },
    });

    // Pending leave requests
    const pendingLeaveRequests = await prisma.leaveRequest.count({
      where: { status: 'pending' },
    });

    res.json({
      success: true,
      data: {
        totalEmployees,
        employeesByDepartment,
        attendanceStats,
        pendingLeaveRequests,
      },
    });
  } catch (error) {
    logger.error('Error generating HR reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating HR reports',
    });
  }
};