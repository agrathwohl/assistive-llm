import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { NotificationFilter } from '../interfaces/notification.interface';
import { logger } from '../utils/logger';

/**
 * Controller for notification-related API endpoints
 */
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /**
   * Get all notifications
   * GET /api/notifications
   */
  getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const filter: NotificationFilter = {};

      // Parse query parameters
      if (req.query.level) {
        filter.level = req.query.level as any;
      }
      if (req.query.category) {
        filter.category = req.query.category as any;
      }
      if (req.query.read !== undefined) {
        filter.read = req.query.read === 'true';
      }
      if (req.query.deviceId) {
        filter.deviceId = req.query.deviceId as string;
      }
      if (req.query.conversationId) {
        filter.conversationId = req.query.conversationId as string;
      }
      if (req.query.startDate) {
        filter.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filter.endDate = new Date(req.query.endDate as string);
      }

      const notifications = this.notificationService.getNotifications(filter);

      res.json({
        success: true,
        count: notifications.length,
        notifications
      });
    } catch (error) {
      logger.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notifications'
      });
    }
  };

  /**
   * Get a single notification by ID
   * GET /api/notifications/:id
   */
  getNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const notification = this.notificationService.getNotification(id);

      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        notification
      });
    } catch (error) {
      logger.error('Error getting notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notification'
      });
    }
  };

  /**
   * Get unread count
   * GET /api/notifications/unread/count
   */
  getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    try {
      const filter: Omit<NotificationFilter, 'read'> = {};

      if (req.query.level) {
        filter.level = req.query.level as any;
      }
      if (req.query.category) {
        filter.category = req.query.category as any;
      }
      if (req.query.deviceId) {
        filter.deviceId = req.query.deviceId as string;
      }

      const count = this.notificationService.getUnreadCount(filter);

      res.json({
        success: true,
        count
      });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get unread count'
      });
    }
  };

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const success = await this.notificationService.markAsRead(id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read'
      });
    }
  };

  /**
   * Mark all notifications as read
   * PUT /api/notifications/read-all
   */
  markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const filter: NotificationFilter = {};

      // Parse query parameters for filtering
      if (req.query.level) {
        filter.level = req.query.level as any;
      }
      if (req.query.category) {
        filter.category = req.query.category as any;
      }
      if (req.query.deviceId) {
        filter.deviceId = req.query.deviceId as string;
      }

      const count = await this.notificationService.markAllAsRead(filter);

      res.json({
        success: true,
        message: `Marked ${count} notifications as read`,
        count
      });
    } catch (error) {
      logger.error('Error marking all as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark all as read'
      });
    }
  };

  /**
   * Delete a notification
   * DELETE /api/notifications/:id
   */
  deleteNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const success = await this.notificationService.deleteNotification(id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Notification deleted'
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete notification'
      });
    }
  };

  /**
   * Clear all notifications
   * DELETE /api/notifications
   */
  clearAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const filter: NotificationFilter = {};

      // Parse query parameters for filtering
      if (req.query.level) {
        filter.level = req.query.level as any;
      }
      if (req.query.category) {
        filter.category = req.query.category as any;
      }
      if (req.query.deviceId) {
        filter.deviceId = req.query.deviceId as string;
      }

      const count = await this.notificationService.clearAll(
        Object.keys(filter).length > 0 ? filter : undefined
      );

      res.json({
        success: true,
        message: `Cleared ${count} notifications`,
        count
      });
    } catch (error) {
      logger.error('Error clearing notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear notifications'
      });
    }
  };
}
