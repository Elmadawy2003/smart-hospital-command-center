import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserProfile,
  changePassword,
  getUserStats
} from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { userSchemas } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Private (Admin, HR Manager)
 */
router.get(
  '/',
  authorize(['admin', 'hr_manager']),
  getUsers
);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private (Admin, HR Manager)
 */
router.get(
  '/stats',
  authorize(['admin', 'hr_manager']),
  getUserStats
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin, HR Manager, or own profile)
 */
router.get(
  '/:id',
  getUserById
);

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private (Admin, HR Manager)
 */
router.post(
  '/',
  authorize(['admin', 'hr_manager']),
  validate(userSchemas.register),
  createUser
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user information
 * @access  Private (Admin, HR Manager, or own profile)
 */
router.put(
  '/:id',
  updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authorize(['admin']),
  deleteUser
);

/**
 * @route   PUT /api/users/:id/profile
 * @desc    Update user profile
 * @access  Private (All authenticated users - own profile)
 */
router.put(
  '/:id/profile',
  updateUserProfile
);

/**
 * @route   PUT /api/users/:id/change-password
 * @desc    Change user password
 * @access  Private (All authenticated users - own profile)
 */
router.put(
  '/:id/change-password',
  validate(userSchemas.changePassword),
  changePassword
);

export default router;