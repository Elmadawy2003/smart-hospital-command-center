import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  broadcastNotification,
  getNotificationPreferences,
  updateNotificationPreferences
} from '../controllers/notificationController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  getNotifications
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notifications count
 * @access  Private (All authenticated users)
 */
router.get(
  '/unread-count',
  getUnreadCount
);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private (All authenticated users)
 */
router.put(
  '/:id/read',
  markAsRead
);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private (All authenticated users)
 */
router.put(
  '/mark-all-read',
  markAllAsRead
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private (All authenticated users)
 */
router.delete(
  '/:id',
  deleteNotification
);

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification
 * @access  Private (Admin, Manager roles)
 */
router.post(
  '/',
  authorize(['admin', 'manager']),
  createNotification
);

/**
 * @route   POST /api/notifications/broadcast
 * @desc    Broadcast notification to multiple users
 * @access  Private (Admin)
 */
router.post(
  '/broadcast',
  authorize(['admin']),
  broadcastNotification
);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user notification preferences
 * @access  Private (All authenticated users)
 */
router.get(
  '/preferences',
  getNotificationPreferences
);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update user notification preferences
 * @access  Private (All authenticated users)
 */
router.put(
  '/preferences',
  updateNotificationPreferences
);

export default router;