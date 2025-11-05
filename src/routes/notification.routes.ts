import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { NotificationService } from '../services/notification.service';

const router = Router();
const notificationService = new NotificationService();
const notificationController = new NotificationController(notificationService);

// Get all notifications (with optional filtering)
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread/count', notificationController.getUnreadCount);

// Mark all as read
router.put('/read-all', notificationController.markAllAsRead);

// Clear all notifications
router.delete('/', notificationController.clearAll);

// Get single notification
router.get('/:id', notificationController.getNotification);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

export { router as notificationRouter, notificationService };
