import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '@/middleware/errorHandler';
import { authMiddleware } from '@/middleware/auth';
import {
  authLimiter,
  passwordResetLimiter,
  validate,
  userSchemas,
  publicApiMiddlewareStack,
  userActivityLogger,
  apiUsageLogger,
} from '@/middleware';
import * as authController from '@/controllers/authController';

const router = Router();

// Validation rules
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least 8 characters with uppercase, lowercase, number and special character'),
  body('firstName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name must be at least 2 characters long'),
  body('lastName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name must be at least 2 characters long'),
  body('role')
    .isIn(['doctor', 'nurse', 'admin', 'pharmacist', 'lab_tech', 'radiologist', 'hr', 'finance'])
    .withMessage('Invalid role'),
  body('department')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Department must be at least 2 characters long'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least 8 characters with uppercase, lowercase, number and special character'),
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least 8 characters with uppercase, lowercase, number and special character'),
];

// Routes with middleware
router.post('/login', 
  ...publicApiMiddlewareStack,
  authLimiter,
  validate(userSchemas.login),
  apiUsageLogger,
  userActivityLogger('User Login'),
  asyncHandler(authController.login)
);

router.post('/register', 
  ...publicApiMiddlewareStack,
  authLimiter,
  validate(userSchemas.register),
  apiUsageLogger,
  userActivityLogger('User Registration'),
  asyncHandler(authController.register)
);

router.post('/refresh-token', 
  ...publicApiMiddlewareStack,
  authLimiter,
  apiUsageLogger,
  asyncHandler(authController.refreshToken)
);

router.post('/logout', 
  ...publicApiMiddlewareStack,
  authMiddleware,
  apiUsageLogger,
  userActivityLogger('User Logout'),
  asyncHandler(authController.logout)
);

router.post('/forgot-password', 
  ...publicApiMiddlewareStack,
  passwordResetLimiter,
  validate(userSchemas.forgotPassword),
  apiUsageLogger,
  userActivityLogger('Password Reset Request'),
  asyncHandler(authController.forgotPassword)
);

router.post('/reset-password', 
  ...publicApiMiddlewareStack,
  passwordResetLimiter,
  validate(userSchemas.resetPassword),
  apiUsageLogger,
  userActivityLogger('Password Reset'),
  asyncHandler(authController.resetPassword)
);

router.post('/change-password', 
  ...publicApiMiddlewareStack,
  authMiddleware,
  authLimiter,
  validate(userSchemas.changePassword),
  apiUsageLogger,
  userActivityLogger('Password Change'),
  asyncHandler(authController.changePassword)
);

router.get('/profile', 
  ...publicApiMiddlewareStack,
  authMiddleware,
  apiUsageLogger,
  userActivityLogger('Profile Access'),
  asyncHandler(authController.getProfile)
);

router.put('/profile', 
  ...publicApiMiddlewareStack,
  authMiddleware,
  validate(userSchemas.updateProfile),
  apiUsageLogger,
  userActivityLogger('Profile Update'),
  asyncHandler(authController.updateProfile)
);

router.get('/verify-token', 
  ...publicApiMiddlewareStack,
  authMiddleware,
  apiUsageLogger,
  asyncHandler(authController.verifyToken)
);

export default router;