import { prisma } from '@/config/database';
import { io } from '@/config/socket';
import { logger } from '@/utils/logger';
import { CacheService } from '@/services/cacheService';

export interface NotificationData {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  userId?: string;
  departmentId?: string;
  role?: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  expiresAt?: Date;
}

export interface EmailData {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface SMSData {
  to: string;
  message: string;
}

export class NotificationService {
  /**
   * Create and send notification
   */
  static async createNotification(data: NotificationData): Promise<void> {
    try {
      // Create notification in database
      const notification = await prisma.notification.create({
        data: {
          title: data.title,
          message: data.message,
          type: data.type,
          userId: data.userId,
          departmentId: data.departmentId,
          role: data.role,
          metadata: data.metadata,
          priority: data.priority || 'medium',
          expiresAt: data.expiresAt,
        },
      });

      // Send real-time notification via WebSocket
      await this.sendRealTimeNotification(notification);

      // Clear user notifications cache if user-specific
      if (data.userId) {
        await CacheService.del(`notifications:user:${data.userId}`);
      }

      logger.info(`Notification created: ${notification.id}`);
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send real-time notification via WebSocket
   */
  private static async sendRealTimeNotification(notification: any): Promise<void> {
    try {
      if (notification.userId) {
        // Send to specific user
        io.to(`user:${notification.userId}`).emit('notification', notification);
      } else if (notification.departmentId) {
        // Send to department
        io.to(`department:${notification.departmentId}`).emit('notification', notification);
      } else if (notification.role) {
        // Send to role
        io.to(`role:${notification.role}`).emit('notification', notification);
      } else {
        // Broadcast to all connected users
        io.emit('notification', notification);
      }
    } catch (error) {
      logger.error('Error sending real-time notification:', error);
    }
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    try {
      // Try to get from cache first
      const cacheKey = `notifications:user:${userId}:${page}:${limit}:${unreadOnly}`;
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const where = {
        OR: [
          { userId },
          { role: { in: await this.getUserRoles(userId) } },
          { departmentId: await this.getUserDepartment(userId) },
        ],
        AND: [
          { expiresAt: { gte: new Date() } },
          unreadOnly ? { readAt: null } : {},
        ],
      };

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: {
            ...where,
            readAt: null,
          },
        }),
      ]);

      const result = { notifications, total, unreadCount };

      // Cache for 5 minutes
      await CacheService.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await prisma.notification.update({
        where: {
          id: notificationId,
          OR: [
            { userId },
            { role: { in: await this.getUserRoles(userId) } },
            { departmentId: await this.getUserDepartment(userId) },
          ],
        },
        data: {
          readAt: new Date(),
        },
      });

      // Clear cache
      await CacheService.delByPattern(`notifications:user:${userId}:*`);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: {
          OR: [
            { userId },
            { role: { in: await this.getUserRoles(userId) } },
            { departmentId: await this.getUserDepartment(userId) },
          ],
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      // Clear cache
      await CacheService.delByPattern(`notifications:user:${userId}:*`);
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      await prisma.notification.delete({
        where: {
          id: notificationId,
          userId, // Only allow deletion of user-specific notifications
        },
      });

      // Clear cache
      await CacheService.delByPattern(`notifications:user:${userId}:*`);
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Send appointment reminder
   */
  static async sendAppointmentReminder(appointmentId: string): Promise<void> {
    try {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: true,
          doctor: true,
        },
      });

      if (!appointment) return;

      await this.createNotification({
        title: 'Appointment Reminder',
        message: `You have an appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} at ${appointment.appointmentTime}`,
        type: 'info',
        userId: appointment.patient.id,
        priority: 'medium',
        metadata: {
          appointmentId: appointment.id,
          type: 'appointment_reminder',
        },
      });
    } catch (error) {
      logger.error('Error sending appointment reminder:', error);
    }
  }

  /**
   * Send critical alert
   */
  static async sendCriticalAlert(
    title: string,
    message: string,
    targetUsers?: string[],
    targetRoles?: string[]
  ): Promise<void> {
    try {
      const notifications = [];

      if (targetUsers) {
        for (const userId of targetUsers) {
          notifications.push({
            title,
            message,
            type: 'error' as const,
            userId,
            priority: 'critical' as const,
            metadata: { type: 'critical_alert' },
          });
        }
      }

      if (targetRoles) {
        for (const role of targetRoles) {
          notifications.push({
            title,
            message,
            type: 'error' as const,
            role,
            priority: 'critical' as const,
            metadata: { type: 'critical_alert' },
          });
        }
      }

      // Create all notifications
      for (const notificationData of notifications) {
        await this.createNotification(notificationData);
      }
    } catch (error) {
      logger.error('Error sending critical alert:', error);
    }
  }

  /**
   * Send inventory low stock alert
   */
  static async sendLowStockAlert(medicationName: string, currentStock: number): Promise<void> {
    try {
      await this.createNotification({
        title: 'Low Stock Alert',
        message: `${medicationName} is running low. Current stock: ${currentStock}`,
        type: 'warning',
        role: 'pharmacist',
        priority: 'high',
        metadata: {
          type: 'low_stock_alert',
          medicationName,
          currentStock,
        },
      });
    } catch (error) {
      logger.error('Error sending low stock alert:', error);
    }
  }

  /**
   * Send system maintenance notification
   */
  static async sendMaintenanceNotification(
    startTime: Date,
    endTime: Date,
    description: string
  ): Promise<void> {
    try {
      await this.createNotification({
        title: 'Scheduled Maintenance',
        message: `System maintenance scheduled from ${startTime.toLocaleString()} to ${endTime.toLocaleString()}. ${description}`,
        type: 'info',
        priority: 'medium',
        metadata: {
          type: 'maintenance',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error sending maintenance notification:', error);
    }
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications(): Promise<void> {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      logger.info(`Cleaned up ${result.count} expired notifications`);
    } catch (error) {
      logger.error('Error cleaning up expired notifications:', error);
    }
  }

  /**
   * Get user roles (helper method)
   */
  private static async getUserRoles(userId: string): Promise<string[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      return user ? [user.role] : [];
    } catch {
      return [];
    }
  }

  /**
   * Get user department (helper method)
   */
  private static async getUserDepartment(userId: string): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      return user?.departmentId || null;
    } catch {
      return null;
    }
  }

  /**
   * Send email notification (placeholder for email service integration)
   */
  static async sendEmail(data: EmailData): Promise<void> {
    try {
      // This would integrate with an email service like SendGrid, AWS SES, etc.
      logger.info(`Email would be sent to: ${data.to}, Subject: ${data.subject}`);
      
      // Example implementation:
      // await emailProvider.send({
      //   to: data.to,
      //   subject: data.subject,
      //   template: data.template,
      //   data: data.data,
      // });
    } catch (error) {
      logger.error('Error sending email:', error);
    }
  }

  /**
   * Send SMS notification (placeholder for SMS service integration)
   */
  static async sendSMS(data: SMSData): Promise<void> {
    try {
      // This would integrate with an SMS service like Twilio, AWS SNS, etc.
      logger.info(`SMS would be sent to: ${data.to}, Message: ${data.message}`);
      
      // Example implementation:
      // await smsProvider.send({
      //   to: data.to,
      //   message: data.message,
      // });
    } catch (error) {
      logger.error('Error sending SMS:', error);
    }
  }
}