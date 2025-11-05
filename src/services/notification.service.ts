import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Notification,
  NotificationLevel,
  NotificationCategory,
  NotificationFilter,
  NotificationPreferences
} from '../interfaces/notification.interface';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * Service for managing notifications
 */
export class NotificationService {
  private notifications: Notification[] = [];
  private notificationsPath: string;
  private maxNotifications: number = 1000; // Keep last 1000 notifications
  private broadcastCallbacks: Set<(notification: Notification) => void> = new Set();

  constructor() {
    this.notificationsPath = path.join(process.cwd(), config.database.path, 'notifications.json');
    this.loadNotifications();
  }

  /**
   * Load notifications from disk
   */
  private async loadNotifications(): Promise<void> {
    try {
      if (fs.existsSync(this.notificationsPath)) {
        const data = await fs.promises.readFile(this.notificationsPath, 'utf-8');
        const saved = JSON.parse(data);

        // Convert timestamp strings back to Date objects
        this.notifications = saved.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));

        logger.info(`Loaded ${this.notifications.length} notifications`);
      }
    } catch (error) {
      logger.error('Error loading notifications:', error);
    }
  }

  /**
   * Save notifications to disk
   */
  private async saveNotifications(): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.notificationsPath,
        JSON.stringify(this.notifications, null, 2)
      );
    } catch (error) {
      logger.error('Error saving notifications:', error);
    }
  }

  /**
   * Create a new notification
   */
  async create(
    level: NotificationLevel,
    category: NotificationCategory,
    title: string,
    message: string,
    options?: {
      deviceId?: string;
      conversationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Notification> {
    const notification: Notification = {
      id: uuidv4(),
      level,
      category,
      title,
      message,
      timestamp: new Date(),
      read: false,
      deviceId: options?.deviceId,
      conversationId: options?.conversationId,
      metadata: options?.metadata
    };

    this.notifications.unshift(notification); // Add to beginning

    // Trim to max notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    await this.saveNotifications();

    // Broadcast to all listeners
    this.broadcast(notification);

    // Log based on level
    const logMessage = `[${category}] ${title}: ${message}`;
    switch (level) {
      case NotificationLevel.CRITICAL:
      case NotificationLevel.ERROR:
        logger.error(logMessage);
        break;
      case NotificationLevel.WARNING:
        logger.warn(logMessage);
        break;
      case NotificationLevel.SUCCESS:
      case NotificationLevel.INFO:
        logger.info(logMessage);
        break;
    }

    return notification;
  }

  /**
   * Get all notifications with optional filtering
   */
  getNotifications(filter?: NotificationFilter): Notification[] {
    let filtered = [...this.notifications];

    if (filter) {
      if (filter.level) {
        filtered = filtered.filter(n => n.level === filter.level);
      }
      if (filter.category) {
        filtered = filtered.filter(n => n.category === filter.category);
      }
      if (filter.read !== undefined) {
        filtered = filtered.filter(n => n.read === filter.read);
      }
      if (filter.deviceId) {
        filtered = filtered.filter(n => n.deviceId === filter.deviceId);
      }
      if (filter.conversationId) {
        filtered = filtered.filter(n => n.conversationId === filter.conversationId);
      }
      if (filter.startDate) {
        filtered = filtered.filter(n => n.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        filtered = filtered.filter(n => n.timestamp <= filter.endDate!);
      }
    }

    return filtered;
  }

  /**
   * Get a single notification by ID
   */
  getNotification(id: string): Notification | undefined {
    return this.notifications.find(n => n.id === id);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<boolean> {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      await this.saveNotifications();
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(filter?: NotificationFilter): Promise<number> {
    const toMark = this.getNotifications(filter);
    let count = 0;

    for (const notification of toMark) {
      if (!notification.read) {
        notification.read = true;
        count++;
      }
    }

    if (count > 0) {
      await this.saveNotifications();
    }

    return count;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: string): Promise<boolean> {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      await this.saveNotifications();
      return true;
    }
    return false;
  }

  /**
   * Clear all notifications
   */
  async clearAll(filter?: NotificationFilter): Promise<number> {
    const toDelete = this.getNotifications(filter);
    const count = toDelete.length;

    if (filter) {
      // Remove filtered notifications
      this.notifications = this.notifications.filter(
        n => !toDelete.some(d => d.id === n.id)
      );
    } else {
      // Clear all
      this.notifications = [];
    }

    if (count > 0) {
      await this.saveNotifications();
    }

    return count;
  }

  /**
   * Get unread count
   */
  getUnreadCount(filter?: Omit<NotificationFilter, 'read'>): number {
    return this.getNotifications({ ...filter, read: false }).length;
  }

  /**
   * Register a callback for broadcasting notifications
   */
  onNotification(callback: (notification: Notification) => void): () => void {
    this.broadcastCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.broadcastCallbacks.delete(callback);
    };
  }

  /**
   * Broadcast notification to all listeners
   */
  private broadcast(notification: Notification): void {
    this.broadcastCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        logger.error('Error broadcasting notification:', error);
      }
    });
  }

  // Convenience methods for common notification types

  /**
   * Device connected notification
   */
  async notifyDeviceConnected(deviceId: string, deviceName: string): Promise<Notification> {
    return this.create(
      NotificationLevel.SUCCESS,
      NotificationCategory.DEVICE,
      'Device Connected',
      `${deviceName} has successfully connected`,
      { deviceId }
    );
  }

  /**
   * Device disconnected notification
   */
  async notifyDeviceDisconnected(deviceId: string, deviceName: string): Promise<Notification> {
    return this.create(
      NotificationLevel.WARNING,
      NotificationCategory.DEVICE,
      'Device Disconnected',
      `${deviceName} has disconnected`,
      { deviceId }
    );
  }

  /**
   * Device error notification
   */
  async notifyDeviceError(deviceId: string, deviceName: string, error: string): Promise<Notification> {
    return this.create(
      NotificationLevel.ERROR,
      NotificationCategory.DEVICE,
      'Device Error',
      `${deviceName}: ${error}`,
      { deviceId, metadata: { error } }
    );
  }

  /**
   * LLM streaming started notification
   */
  async notifyLLMStreamStarted(
    provider: string,
    deviceId: string,
    conversationId: string
  ): Promise<Notification> {
    return this.create(
      NotificationLevel.INFO,
      NotificationCategory.LLM,
      'LLM Stream Started',
      `Started streaming response from ${provider}`,
      { deviceId, conversationId, metadata: { provider } }
    );
  }

  /**
   * LLM streaming completed notification
   */
  async notifyLLMStreamCompleted(
    provider: string,
    deviceId: string,
    conversationId: string
  ): Promise<Notification> {
    return this.create(
      NotificationLevel.SUCCESS,
      NotificationCategory.LLM,
      'LLM Stream Completed',
      `Completed streaming response from ${provider}`,
      { deviceId, conversationId, metadata: { provider } }
    );
  }

  /**
   * LLM error notification
   */
  async notifyLLMError(
    provider: string,
    error: string,
    deviceId?: string,
    conversationId?: string
  ): Promise<Notification> {
    return this.create(
      NotificationLevel.ERROR,
      NotificationCategory.LLM,
      'LLM Error',
      `${provider}: ${error}`,
      { deviceId, conversationId, metadata: { provider, error } }
    );
  }

  /**
   * System startup notification
   */
  async notifySystemStartup(): Promise<Notification> {
    return this.create(
      NotificationLevel.INFO,
      NotificationCategory.SYSTEM,
      'System Started',
      'Assistive LLM service has started successfully'
    );
  }

  /**
   * System shutdown notification
   */
  async notifySystemShutdown(): Promise<Notification> {
    return this.create(
      NotificationLevel.INFO,
      NotificationCategory.SYSTEM,
      'System Shutting Down',
      'Assistive LLM service is shutting down'
    );
  }

  /**
   * Configuration error notification
   */
  async notifyConfigError(error: string): Promise<Notification> {
    return this.create(
      NotificationLevel.CRITICAL,
      NotificationCategory.SYSTEM,
      'Configuration Error',
      error
    );
  }

  /**
   * Security alert notification
   */
  async notifySecurityAlert(title: string, message: string): Promise<Notification> {
    return this.create(
      NotificationLevel.CRITICAL,
      NotificationCategory.SECURITY,
      title,
      message
    );
  }
}
