import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { APIResponse, Notification, NotificationPreferences } from '@/types';

export const getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;
    const isRead = req.query.isRead as string;
    const priority = req.query.priority as string;

    const offset = (page - 1) * limit;
    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const cacheKey = `notifications_${userId}_${page}_${limit}_${type}_${isRead}_${priority}`;

    // Try to get from cache first
    const cachedNotifications = await getCache(cacheKey);
    if (cachedNotifications) {
      const response: APIResponse<any> = {
        success: true,
        data: cachedNotifications,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();

    // Build WHERE clause
    let whereConditions = ['recipient_id = $1'];
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (type) {
      whereConditions.push(`type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (isRead !== undefined) {
      whereConditions.push(`is_read = $${paramIndex}`);
      queryParams.push(isRead === 'true');
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get notifications with pagination
    const notificationsQuery = `
      SELECT 
        id,
        title,
        message,
        type,
        priority,
        is_read,
        data,
        created_at,
        read_at
      FROM notifications 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications 
      WHERE ${whereClause}
    `;

    const [notificationsResult, countResult] = await Promise.all([
      db.query(notificationsQuery, queryParams),
      db.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);

    const notifications = notificationsResult.rows;
    const total = parseInt(countResult.rows[0].total);

    const result = {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Cache for 2 minutes
    await setCache(cacheKey, result, 120);

    const response: APIResponse<any> = {
      success: true,
      data: result,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    throw error;
  }
};

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const cacheKey = `unread_notifications_${userId}`;

    // Try to get from cache first
    const cachedCount = await getCache(cacheKey);
    if (cachedCount !== null) {
      const response: APIResponse<{ count: number }> = {
        success: true,
        data: { count: cachedCount },
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();

    const countQuery = `
      SELECT COUNT(*) as count
      FROM notifications 
      WHERE recipient_id = $1 AND is_read = false
    `;

    const result = await db.query(countQuery, [userId]);
    const count = parseInt(result.rows[0].count);

    // Cache for 1 minute
    await setCache(cacheKey, count, 60);

    const response: APIResponse<{ count: number }> = {
      success: true,
      data: { count },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching unread notifications count:', error);
    throw error;
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const { notificationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const db = getDatabase();

    // Check if notification exists and belongs to user
    const checkQuery = `
      SELECT id FROM notifications 
      WHERE id = $1 AND recipient_id = $2
    `;

    const checkResult = await db.query(checkQuery, [notificationId, userId]);

    if (checkResult.rows.length === 0) {
      throw new CustomError('Notification not found', 404);
    }

    // Mark as read
    const updateQuery = `
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND recipient_id = $2
      RETURNING *
    `;

    const result = await db.query(updateQuery, [notificationId, userId]);

    // Clear cache
    await deleteCache(`unread_notifications_${userId}`);
    await deleteCache(`notifications_${userId}_*`);

    const response: APIResponse<Notification> = {
      success: true,
      data: result.rows[0],
      message: 'Notification marked as read',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const db = getDatabase();

    const updateQuery = `
      UPDATE notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE recipient_id = $1 AND is_read = false
    `;

    const result = await db.query(updateQuery, [userId]);

    // Clear cache
    await deleteCache(`unread_notifications_${userId}`);
    await deleteCache(`notifications_${userId}_*`);

    const response: APIResponse<{ updatedCount: number }> = {
      success: true,
      data: { updatedCount: result.rowCount || 0 },
      message: 'All notifications marked as read',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const { notificationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const db = getDatabase();

    // Check if notification exists and belongs to user
    const checkQuery = `
      SELECT id FROM notifications 
      WHERE id = $1 AND recipient_id = $2
    `;

    const checkResult = await db.query(checkQuery, [notificationId, userId]);

    if (checkResult.rows.length === 0) {
      throw new CustomError('Notification not found', 404);
    }

    // Delete notification
    const deleteQuery = `
      DELETE FROM notifications 
      WHERE id = $1 AND recipient_id = $2
    `;

    await db.query(deleteQuery, [notificationId, userId]);

    // Clear cache
    await deleteCache(`unread_notifications_${userId}`);
    await deleteCache(`notifications_${userId}_*`);

    const response: APIResponse<null> = {
      success: true,
      data: null,
      message: 'Notification deleted successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error deleting notification:', error);
    throw error;
  }
};

export const createNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const {
      recipientId,
      title,
      message,
      type,
      priority = 'medium',
      data = {}
    } = req.body;

    const db = getDatabase();

    // Check if recipient exists
    const userCheckQuery = `
      SELECT id FROM users WHERE id = $1
    `;

    const userCheckResult = await db.query(userCheckQuery, [recipientId]);

    if (userCheckResult.rows.length === 0) {
      throw new CustomError('Recipient not found', 404);
    }

    const notificationId = uuidv4();

    const insertQuery = `
      INSERT INTO notifications (
        id, recipient_id, title, message, type, priority, data, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      notificationId,
      recipientId,
      title,
      message,
      type,
      priority,
      JSON.stringify(data)
    ]);

    // Clear cache for recipient
    await deleteCache(`unread_notifications_${recipientId}`);
    await deleteCache(`notifications_${recipientId}_*`);

    const response: APIResponse<Notification> = {
      success: true,
      data: result.rows[0],
      message: 'Notification created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

export const broadcastNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const {
      title,
      message,
      type,
      priority = 'medium',
      data = {},
      targetRole,
      targetDepartment
    } = req.body;

    const db = getDatabase();

    // Build user filter query
    let userFilterQuery = 'SELECT id FROM users WHERE 1=1';
    const filterParams: any[] = [];
    let paramIndex = 1;

    if (targetRole) {
      userFilterQuery += ` AND role = $${paramIndex}`;
      filterParams.push(targetRole);
      paramIndex++;
    }

    if (targetDepartment) {
      userFilterQuery += ` AND department_id = $${paramIndex}`;
      filterParams.push(targetDepartment);
      paramIndex++;
    }

    // Get target users
    const usersResult = await db.query(userFilterQuery, filterParams);
    const targetUsers = usersResult.rows;

    if (targetUsers.length === 0) {
      throw new CustomError('No users found matching the criteria', 404);
    }

    // Create notifications for all target users
    const notifications = targetUsers.map(user => ({
      id: uuidv4(),
      recipient_id: user.id,
      title,
      message,
      type,
      priority,
      data: JSON.stringify(data)
    }));

    // Batch insert notifications
    const insertQuery = `
      INSERT INTO notifications (
        id, recipient_id, title, message, type, priority, data, created_at
      ) VALUES ${notifications.map((_, index) => 
        `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7}, CURRENT_TIMESTAMP)`
      ).join(', ')}
    `;

    const insertParams = notifications.flatMap(n => [
      n.id, n.recipient_id, n.title, n.message, n.type, n.priority, n.data
    ]);

    await db.query(insertQuery, insertParams);

    // Clear cache for all affected users
    for (const user of targetUsers) {
      await deleteCache(`unread_notifications_${user.id}`);
      await deleteCache(`notifications_${user.id}_*`);
    }

    const response: APIResponse<{ notificationCount: number }> = {
      success: true,
      data: { notificationCount: notifications.length },
      message: `Broadcast notification sent to ${notifications.length} users`,
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error broadcasting notification:', error);
    throw error;
  }
};

export const getNotificationPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const db = getDatabase();

    const preferencesQuery = `
      SELECT * FROM notification_preferences 
      WHERE user_id = $1
    `;

    const result = await db.query(preferencesQuery, [userId]);

    let preferences = result.rows[0];

    // If no preferences exist, create default ones
    if (!preferences) {
      const defaultPreferences = {
        user_id: userId,
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
        appointment_reminders: true,
        lab_results: true,
        billing_alerts: true,
        system_updates: true,
        marketing_emails: false
      };

      const insertQuery = `
        INSERT INTO notification_preferences (
          user_id, email_notifications, push_notifications, sms_notifications,
          appointment_reminders, lab_results, billing_alerts, system_updates, marketing_emails
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const insertResult = await db.query(insertQuery, [
        defaultPreferences.user_id,
        defaultPreferences.email_notifications,
        defaultPreferences.push_notifications,
        defaultPreferences.sms_notifications,
        defaultPreferences.appointment_reminders,
        defaultPreferences.lab_results,
        defaultPreferences.billing_alerts,
        defaultPreferences.system_updates,
        defaultPreferences.marketing_emails
      ]);

      preferences = insertResult.rows[0];
    }

    const response: APIResponse<NotificationPreferences> = {
      success: true,
      data: preferences,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching notification preferences:', error);
    throw error;
  }
};

export const updateNotificationPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationErrorHandler(errors.array(), res);
    }

    const userId = req.user?.id;

    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const {
      emailNotifications,
      pushNotifications,
      smsNotifications,
      appointmentReminders,
      labResults,
      billingAlerts,
      systemUpdates,
      marketingEmails
    } = req.body;

    const db = getDatabase();

    const updateQuery = `
      UPDATE notification_preferences 
      SET 
        email_notifications = $2,
        push_notifications = $3,
        sms_notifications = $4,
        appointment_reminders = $5,
        lab_results = $6,
        billing_alerts = $7,
        system_updates = $8,
        marketing_emails = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [
      userId,
      emailNotifications,
      pushNotifications,
      smsNotifications,
      appointmentReminders,
      labResults,
      billingAlerts,
      systemUpdates,
      marketingEmails
    ]);

    if (result.rows.length === 0) {
      throw new CustomError('Notification preferences not found', 404);
    }

    const response: APIResponse<NotificationPreferences> = {
      success: true,
      data: result.rows[0],
      message: 'Notification preferences updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    throw error;
  }
};