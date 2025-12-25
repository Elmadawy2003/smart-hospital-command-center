import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  getAttendance,
  markAttendance,
  getLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  getPayroll,
  generatePayroll,
  getHRReports,
} from '@/controllers/hrController';
import { authMiddleware, requireRole, requirePermission } from '@/middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Employee Management Routes
router.get(
  '/employees',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('department').optional().isUUID(),
    query('role').optional().isIn(['admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech', 'radiologist', 'hr', 'finance', 'receptionist']),
    query('status').optional().isIn(['active', 'inactive', 'terminated']),
  ],
  requirePermission('hr:read'),
  getEmployees
);

router.get(
  '/employees/:id',
  [param('id').isUUID()],
  requirePermission('hr:read'),
  getEmployeeById
);

router.post(
  '/employees',
  [
    body('firstName').notEmpty().trim().isLength({ min: 2, max: 50 }),
    body('lastName').notEmpty().trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('phone').notEmpty().trim().matches(/^[\+]?[1-9][\d]{0,15}$/),
    body('role').notEmpty().isIn(['admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech', 'radiologist', 'hr', 'finance', 'receptionist']),
    body('departmentId').isUUID(),
    body('dateOfBirth').isISO8601(),
    body('gender').isIn(['male', 'female', 'other']),
    body('address').optional().trim().isLength({ max: 200 }),
    body('emergencyContact').optional().trim().isLength({ max: 100 }),
    body('emergencyPhone').optional().trim().matches(/^[\+]?[1-9][\d]{0,15}$/),
    body('qualification').optional().trim().isLength({ max: 200 }),
    body('experience').optional().isInt({ min: 0 }),
    body('specialization').optional().trim().isLength({ max: 100 }),
    body('licenseNumber').optional().trim().isLength({ max: 50 }),
    body('joiningDate').isISO8601(),
    body('salary').isFloat({ min: 0 }),
    body('employmentType').optional().isIn(['full_time', 'part_time', 'contract', 'intern']),
  ],
  requirePermission('hr:create'),
  createEmployee
);

router.put(
  '/employees/:id',
  [
    param('id').isUUID(),
    body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
    body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim().matches(/^[\+]?[1-9][\d]{0,15}$/),
    body('role').optional().isIn(['admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech', 'radiologist', 'hr', 'finance', 'receptionist']),
    body('departmentId').optional().isUUID(),
    body('address').optional().trim().isLength({ max: 200 }),
    body('emergencyContact').optional().trim().isLength({ max: 100 }),
    body('emergencyPhone').optional().trim().matches(/^[\+]?[1-9][\d]{0,15}$/),
    body('qualification').optional().trim().isLength({ max: 200 }),
    body('experience').optional().isInt({ min: 0 }),
    body('specialization').optional().trim().isLength({ max: 100 }),
    body('licenseNumber').optional().trim().isLength({ max: 50 }),
    body('salary').optional().isFloat({ min: 0 }),
    body('employmentType').optional().isIn(['full_time', 'part_time', 'contract', 'intern']),
    body('status').optional().isIn(['active', 'inactive', 'terminated']),
  ],
  requirePermission('hr:update'),
  updateEmployee
);

router.delete(
  '/employees/:id',
  [param('id').isUUID()],
  requirePermission('hr:delete'),
  deactivateEmployee
);

// Attendance Management Routes
router.get(
  '/attendance',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('employeeId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('hr:read'),
  getAttendance
);

router.post(
  '/attendance',
  [
    body('employeeId').isUUID(),
    body('date').isISO8601(),
    body('checkIn').isISO8601(),
    body('checkOut').optional().isISO8601(),
    body('breakTime').optional().isInt({ min: 0 }),
    body('overtime').optional().isInt({ min: 0 }),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  requirePermission('hr:create'),
  markAttendance
);

// Leave Management Routes
router.get(
  '/leave-requests',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('employeeId').optional().isUUID(),
  ],
  requirePermission('hr:read'),
  getLeaveRequests
);

router.post(
  '/leave-requests',
  [
    body('employeeId').isUUID(),
    body('leaveType').notEmpty().isIn(['sick', 'vacation', 'personal', 'maternity', 'paternity', 'emergency']),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('reason').notEmpty().trim().isLength({ min: 10, max: 500 }),
    body('isHalfDay').optional().isBoolean(),
  ],
  requirePermission('hr:create'),
  createLeaveRequest
);

router.put(
  '/leave-requests/:id/approve',
  [
    param('id').isUUID(),
    body('status').isIn(['approved', 'rejected']),
    body('comments').optional().trim().isLength({ max: 500 }),
  ],
  requireRole(['hr', 'admin']),
  approveLeaveRequest
);

// Payroll Management Routes
router.get(
  '/payroll',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('employeeId').optional().isUUID(),
    query('year').optional().isInt({ min: 2020, max: 2030 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
  ],
  requirePermission('hr:read'),
  getPayroll
);

router.post(
  '/payroll/generate',
  [
    body('employeeId').isUUID(),
    body('year').isInt({ min: 2020, max: 2030 }),
    body('month').isInt({ min: 1, max: 12 }),
    body('basicSalary').isFloat({ min: 0 }),
    body('allowances').optional().isFloat({ min: 0 }),
    body('deductions').optional().isFloat({ min: 0 }),
    body('overtime').optional().isFloat({ min: 0 }),
    body('bonus').optional().isFloat({ min: 0 }),
  ],
  requireRole(['hr', 'admin']),
  generatePayroll
);

// Reports Routes
router.get(
  '/reports',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('hr:reports'),
  getHRReports
);

export default router;