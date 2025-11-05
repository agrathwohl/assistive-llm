/**
 * Notification interfaces for the application
 */

/**
 * Notification levels
 */
export enum NotificationLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Notification categories
 */
export enum NotificationCategory {
  DEVICE = 'device',
  LLM = 'llm',
  SYSTEM = 'system',
  SECURITY = 'security',
  CONVERSATION = 'conversation'
}

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  level: NotificationLevel;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  deviceId?: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

/**
 * Notification filter options
 */
export interface NotificationFilter {
  level?: NotificationLevel;
  category?: NotificationCategory;
  read?: boolean;
  deviceId?: string;
  conversationId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  enableBrowserNotifications: boolean;
  enableSoundAlerts: boolean;
  enableEmailNotifications: boolean;
  levels: {
    [NotificationLevel.INFO]: boolean;
    [NotificationLevel.SUCCESS]: boolean;
    [NotificationLevel.WARNING]: boolean;
    [NotificationLevel.ERROR]: boolean;
    [NotificationLevel.CRITICAL]: boolean;
  };
  categories: {
    [NotificationCategory.DEVICE]: boolean;
    [NotificationCategory.LLM]: boolean;
    [NotificationCategory.SYSTEM]: boolean;
    [NotificationCategory.SECURITY]: boolean;
    [NotificationCategory.CONVERSATION]: boolean;
  };
}
