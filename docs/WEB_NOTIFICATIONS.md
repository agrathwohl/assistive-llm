# Web Notifications System

## Overview

Implement a comprehensive notification system to alert users about important status changes, device updates, and system events in the Assistive-LLM application.

## Notification Types

### Critical Alerts
- Device connection lost
- LLM provider API failures
- System errors or crashes
- Security issues

### Important Updates
- Device connected successfully
- LLM streaming started/completed
- Conversation saved
- Configuration changes

### Informational
- New device registered
- System performance metrics
- Usage statistics
- Feature updates

---

## Architecture

```
┌──────────────────────────────────────────┐
│         Frontend (Browser)               │
│  ┌────────────────────────────────────┐  │
│  │   Notification Manager             │  │
│  │  • Browser Notifications API       │  │
│  │  • In-App Toast Notifications      │  │
│  │  • Status Badge Updates            │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│                 │ WebSocket               │
│                 │                         │
└─────────────────┼─────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         Backend (Node.js)                   │
│  ┌───────────────────────────────────────┐  │
│  │   Notification Service                │  │
│  │  • Event Emitter                      │  │
│  │  • WebSocket Broadcaster              │  │
│  │  • Push Notification Service          │  │
│  │  • Notification History Storage       │  │
│  └───────────────────────────────────────┘  │
│                 ▲                           │
│                 │                           │
│    ┌────────────┴────────────┐              │
│    │                         │              │
│  ┌─▼──────────┐      ┌──────▼──────┐       │
│  │   Device   │      │     LLM     │       │
│  │  Service   │      │   Service   │       │
│  └────────────┘      └─────────────┘       │
└─────────────────────────────────────────────┘
```

---

## Implementation

### 1. Backend Notification Service

```typescript
// src/services/notification.service.ts
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketManager } from './websocket-manager.service';

export enum NotificationLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum NotificationCategory {
  DEVICE = 'device',
  LLM = 'llm',
  SYSTEM = 'system',
  SECURITY = 'security',
  CONVERSATION = 'conversation'
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  category: NotificationCategory;
  timestamp: Date;
  metadata?: Record<string, any>;
  read: boolean;
  dismissed: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

export class NotificationService extends EventEmitter {
  private notifications: Map<string, Notification> = new Map();
  private wsManager: WebSocketManager;
  private maxHistory: number = 100;

  constructor(wsManager: WebSocketManager) {
    super();
    this.wsManager = wsManager;
  }

  /**
   * Send a notification
   */
  notify(
    title: string,
    message: string,
    level: NotificationLevel,
    category: NotificationCategory,
    options?: {
      metadata?: Record<string, any>;
      actionUrl?: string;
      actionLabel?: string;
    }
  ): Notification {
    const notification: Notification = {
      id: uuidv4(),
      title,
      message,
      level,
      category,
      timestamp: new Date(),
      metadata: options?.metadata,
      actionUrl: options?.actionUrl,
      actionLabel: options?.actionLabel,
      read: false,
      dismissed: false
    };

    // Store notification
    this.notifications.set(notification.id, notification);

    // Trim old notifications
    if (this.notifications.size > this.maxHistory) {
      const oldest = Array.from(this.notifications.keys())[0];
      this.notifications.delete(oldest);
    }

    // Broadcast to connected clients
    this.wsManager.broadcast('notification', notification);

    // Emit event for internal listeners
    this.emit('notification', notification);

    // Log based on level
    this.logNotification(notification);

    return notification;
  }

  /**
   * Device-specific notifications
   */
  notifyDeviceConnected(deviceId: string, deviceName: string) {
    this.notify(
      'Device Connected',
      `${deviceName} is now online and ready`,
      NotificationLevel.SUCCESS,
      NotificationCategory.DEVICE,
      {
        metadata: { deviceId, deviceName },
        actionUrl: `/devices/${deviceId}`,
        actionLabel: 'View Device'
      }
    );
  }

  notifyDeviceDisconnected(deviceId: string, deviceName: string, reason?: string) {
    this.notify(
      'Device Disconnected',
      `${deviceName} has disconnected${reason ? `: ${reason}` : ''}`,
      NotificationLevel.WARNING,
      NotificationCategory.DEVICE,
      {
        metadata: { deviceId, deviceName, reason },
        actionUrl: `/devices/${deviceId}`,
        actionLabel: 'Reconnect'
      }
    );
  }

  notifyDeviceError(deviceId: string, deviceName: string, error: string) {
    this.notify(
      'Device Error',
      `${deviceName} encountered an error: ${error}`,
      NotificationLevel.ERROR,
      NotificationCategory.DEVICE,
      {
        metadata: { deviceId, deviceName, error },
        actionUrl: `/devices/${deviceId}`,
        actionLabel: 'View Details'
      }
    );
  }

  /**
   * LLM-specific notifications
   */
  notifyStreamStarted(conversationId: string, deviceIds: string[], provider: string) {
    const deviceCount = deviceIds.length;
    this.notify(
      'Streaming Started',
      `Streaming from ${provider} to ${deviceCount} device${deviceCount > 1 ? 's' : ''}`,
      NotificationLevel.INFO,
      NotificationCategory.LLM,
      {
        metadata: { conversationId, deviceIds, provider },
        actionUrl: `/conversations/${conversationId}`,
        actionLabel: 'View Conversation'
      }
    );
  }

  notifyStreamCompleted(conversationId: string, duration: number) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    this.notify(
      'Streaming Completed',
      `Stream completed in ${minutes}m ${seconds}s`,
      NotificationLevel.SUCCESS,
      NotificationCategory.LLM,
      {
        metadata: { conversationId, duration },
        actionUrl: `/conversations/${conversationId}`,
        actionLabel: 'View History'
      }
    );
  }

  notifyLLMProviderError(provider: string, error: string) {
    this.notify(
      'LLM Provider Error',
      `${provider} is experiencing issues: ${error}`,
      NotificationLevel.ERROR,
      NotificationCategory.LLM,
      {
        metadata: { provider, error },
        actionUrl: '/settings',
        actionLabel: 'Check Settings'
      }
    );
  }

  notifyLLMProviderRestored(provider: string) {
    this.notify(
      'LLM Provider Restored',
      `${provider} is now operational`,
      NotificationLevel.SUCCESS,
      NotificationCategory.LLM,
      { metadata: { provider } }
    );
  }

  /**
   * System notifications
   */
  notifySystemStarted() {
    this.notify(
      'System Started',
      'Assistive-LLM is now running',
      NotificationLevel.SUCCESS,
      NotificationCategory.SYSTEM
    );
  }

  notifySystemError(error: string) {
    this.notify(
      'System Error',
      `System error: ${error}`,
      NotificationLevel.CRITICAL,
      NotificationCategory.SYSTEM,
      {
        metadata: { error },
        actionUrl: '/health',
        actionLabel: 'System Status'
      }
    );
  }

  notifyConfigurationChanged(section: string, user?: string) {
    this.notify(
      'Configuration Updated',
      `${section} configuration has been modified`,
      NotificationLevel.INFO,
      NotificationCategory.SYSTEM,
      {
        metadata: { section, user },
        actionUrl: '/settings',
        actionLabel: 'View Settings'
      }
    );
  }

  notifyDatabaseConnectionLost() {
    this.notify(
      'Database Connection Lost',
      'Lost connection to database. Attempting to reconnect...',
      NotificationLevel.CRITICAL,
      NotificationCategory.SYSTEM
    );
  }

  notifyDatabaseConnectionRestored() {
    this.notify(
      'Database Connection Restored',
      'Successfully reconnected to database',
      NotificationLevel.SUCCESS,
      NotificationCategory.SYSTEM
    );
  }

  /**
   * Security notifications
   */
  notifyUnauthorizedAccess(ip: string, endpoint: string) {
    this.notify(
      'Unauthorized Access Attempt',
      `Blocked unauthorized access from ${ip} to ${endpoint}`,
      NotificationLevel.WARNING,
      NotificationCategory.SECURITY,
      { metadata: { ip, endpoint } }
    );
  }

  notifyRateLimitExceeded(ip: string) {
    this.notify(
      'Rate Limit Exceeded',
      `IP ${ip} has exceeded rate limits`,
      NotificationLevel.WARNING,
      NotificationCategory.SECURITY,
      { metadata: { ip } }
    );
  }

  /**
   * Get all notifications
   */
  getAllNotifications(filter?: {
    category?: NotificationCategory;
    level?: NotificationLevel;
    unreadOnly?: boolean;
  }): Notification[] {
    let notifications = Array.from(this.notifications.values());

    if (filter) {
      if (filter.category) {
        notifications = notifications.filter(n => n.category === filter.category);
      }
      if (filter.level) {
        notifications = notifications.filter(n => n.level === filter.level);
      }
      if (filter.unreadOnly) {
        notifications = notifications.filter(n => !n.read);
      }
    }

    return notifications.sort((a, b) =>
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Mark notification as read
   */
  markAsRead(id: string): boolean {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.read = true;
      this.wsManager.broadcast('notification:read', { id });
      return true;
    }
    return false;
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): void {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    this.wsManager.broadcast('notification:all-read', {});
  }

  /**
   * Dismiss notification
   */
  dismissNotification(id: string): boolean {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.dismissed = true;
      notification.read = true;
      this.wsManager.broadcast('notification:dismissed', { id });
      return true;
    }
    return false;
  }

  /**
   * Clear all dismissed notifications
   */
  clearDismissed(): void {
    const dismissed = Array.from(this.notifications.entries())
      .filter(([_, n]) => n.dismissed)
      .map(([id, _]) => id);

    dismissed.forEach(id => this.notifications.delete(id));
    this.wsManager.broadcast('notification:cleared', { count: dismissed.length });
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return Array.from(this.notifications.values())
      .filter(n => !n.read)
      .length;
  }

  /**
   * Log notification based on level
   */
  private logNotification(notification: Notification): void {
    const message = `[${notification.category.toUpperCase()}] ${notification.title}: ${notification.message}`;

    switch (notification.level) {
      case NotificationLevel.CRITICAL:
      case NotificationLevel.ERROR:
        console.error(message);
        break;
      case NotificationLevel.WARNING:
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  }
}
```

### 2. WebSocket Manager Enhancement

```typescript
// src/services/websocket-manager.service.ts (enhancement)
export class WebSocketManager {
  // ... existing code ...

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * Broadcast to specific room
   */
  broadcastToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }

  /**
   * Send to specific client
   */
  sendToClient(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }
}
```

### 3. Integration with Services

```typescript
// src/services/device.service.ts (enhance with notifications)
import { NotificationService } from './notification.service';

export class DeviceService {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  async connectDevice(id: string): Promise<DeviceConnection | null> {
    const device = await this.getDeviceById(id);

    try {
      // ... connection logic ...

      // Notify on success
      this.notificationService.notifyDeviceConnected(device.id, device.name);

      return connection;
    } catch (error) {
      // Notify on error
      this.notificationService.notifyDeviceError(
        device.id,
        device.name,
        error.message
      );

      return null;
    }
  }

  async disconnectDevice(id: string): Promise<boolean> {
    const connection = activeConnections.get(id);

    try {
      // ... disconnection logic ...

      // Notify on disconnect
      this.notificationService.notifyDeviceDisconnected(
        connection.device.id,
        connection.device.name
      );

      return true;
    } catch (error) {
      return false;
    }
  }
}
```

```typescript
// src/services/llm.service.ts (enhance with notifications)
export class LLMService {
  private notificationService: NotificationService;

  async streamToDevice(...): Promise<...> {
    const startTime = Date.now();

    // Notify stream start
    this.notificationService.notifyStreamStarted(
      conversationId,
      [deviceId],
      provider
    );

    try {
      // ... streaming logic ...

      // Notify completion
      const duration = Math.floor((Date.now() - startTime) / 1000);
      this.notificationService.notifyStreamCompleted(conversationId, duration);

      return { success: true, conversationId, messageId };
    } catch (error) {
      // Notify error
      this.notificationService.notifyLLMProviderError(provider, error.message);

      return { success: false, conversationId, messageId, error: error.message };
    }
  }
}
```

### 4. API Endpoints

```typescript
// src/controllers/notification.controller.ts
import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /**
   * Get all notifications
   */
  getNotifications = (req: Request, res: Response): void => {
    const { category, level, unreadOnly } = req.query;

    const notifications = this.notificationService.getAllNotifications({
      category: category as any,
      level: level as any,
      unreadOnly: unreadOnly === 'true'
    });

    res.json({
      notifications,
      unreadCount: this.notificationService.getUnreadCount()
    });
  };

  /**
   * Get unread count
   */
  getUnreadCount = (req: Request, res: Response): void => {
    const count = this.notificationService.getUnreadCount();
    res.json({ count });
  };

  /**
   * Mark as read
   */
  markAsRead = (req: Request, res: Response): void => {
    const { id } = req.params;
    const success = this.notificationService.markAsRead(id);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  };

  /**
   * Mark all as read
   */
  markAllAsRead = (req: Request, res: Response): void => {
    this.notificationService.markAllAsRead();
    res.json({ success: true });
  };

  /**
   * Dismiss notification
   */
  dismissNotification = (req: Request, res: Response): void => {
    const { id } = req.params;
    const success = this.notificationService.dismissNotification(id);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  };

  /**
   * Clear dismissed
   */
  clearDismissed = (req: Request, res: Response): void => {
    this.notificationService.clearDismissed();
    res.json({ success: true });
  };
}
```

```typescript
// src/routes/notification.routes.ts
import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();
const controller = new NotificationController(notificationService);

router.get('/notifications', controller.getNotifications);
router.get('/notifications/unread-count', controller.getUnreadCount);
router.post('/notifications/:id/read', controller.markAsRead);
router.post('/notifications/read-all', controller.markAllAsRead);
router.post('/notifications/:id/dismiss', controller.dismissNotification);
router.delete('/notifications/dismissed', controller.clearDismissed);

export const notificationRouter = router;
```

---

## Frontend Implementation

### 1. Notification Manager

```typescript
// src/public/js/notification-manager.js
class NotificationManager {
  constructor() {
    this.notifications = [];
    this.ws = null;
    this.permissionGranted = false;

    this.init();
  }

  async init() {
    // Request browser notification permission
    await this.requestPermission();

    // Connect to WebSocket
    this.connectWebSocket();

    // Load existing notifications
    await this.loadNotifications();

    // Setup UI listeners
    this.setupUI();
  }

  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === 'granted';
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws/admin`);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'notification':
          this.handleNewNotification(data.data);
          break;
        case 'notification:read':
          this.markAsReadLocally(data.data.id);
          break;
        case 'notification:all-read':
          this.markAllAsReadLocally();
          break;
        case 'notification:dismissed':
          this.removeNotificationLocally(data.data.id);
          break;
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      // Reconnect after delay
      setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  async loadNotifications() {
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();

      this.notifications = data.notifications;
      this.updateUI();
      this.updateBadge(data.unreadCount);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  handleNewNotification(notification) {
    // Add to local list
    this.notifications.unshift(notification);

    // Update UI
    this.updateUI();
    this.updateBadge();

    // Show in-app toast
    this.showToast(notification);

    // Show browser notification if allowed
    if (this.permissionGranted && !document.hasFocus()) {
      this.showBrowserNotification(notification);
    }

    // Play sound for critical notifications
    if (notification.level === 'critical' || notification.level === 'error') {
      this.playNotificationSound();
    }
  }

  showToast(notification) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${notification.level}`;
    toast.innerHTML = `
      <div class="toast-header">
        <span class="toast-icon">${this.getIcon(notification.level)}</span>
        <strong>${notification.title}</strong>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="toast-body">
        ${notification.message}
        ${notification.actionLabel ? `
          <a href="${notification.actionUrl}" class="toast-action">
            ${notification.actionLabel}
          </a>
        ` : ''}
      </div>
    `;

    document.getElementById('toast-container').appendChild(toast);

    // Auto-remove after delay
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  showBrowserNotification(notification) {
    const browserNotif = new Notification(notification.title, {
      body: notification.message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: notification.id,
      requireInteraction: notification.level === 'critical'
    });

    browserNotif.onclick = () => {
      window.focus();
      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }
      browserNotif.close();
    };
  }

  updateUI() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    container.innerHTML = '';

    this.notifications.forEach(notification => {
      const item = this.createNotificationElement(notification);
      container.appendChild(item);
    });
  }

  createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item notification-${notification.level} ${notification.read ? 'read' : 'unread'}`;
    div.dataset.id = notification.id;

    div.innerHTML = `
      <div class="notification-icon">${this.getIcon(notification.level)}</div>
      <div class="notification-content">
        <div class="notification-header">
          <strong>${notification.title}</strong>
          <span class="notification-time">${this.formatTime(notification.timestamp)}</span>
        </div>
        <div class="notification-message">${notification.message}</div>
        ${notification.actionLabel ? `
          <a href="${notification.actionUrl}" class="notification-action">
            ${notification.actionLabel}
          </a>
        ` : ''}
      </div>
      <div class="notification-actions">
        <button onclick="notificationManager.markAsRead('${notification.id}')" title="Mark as read">
          ✓
        </button>
        <button onclick="notificationManager.dismiss('${notification.id}')" title="Dismiss">
          ×
        </button>
      </div>
    `;

    return div;
  }

  getIcon(level) {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };
    return icons[level] || icons.info;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // Show date
    return date.toLocaleDateString();
  }

  updateBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    const unreadCount = count !== undefined ? count : this.notifications.filter(n => !n.read).length;

    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }

    // Update page title
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) Assistive-LLM`;
    } else {
      document.title = 'Assistive-LLM';
    }
  }

  async markAsRead(id) {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST'
      });

      this.markAsReadLocally(id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  markAsReadLocally(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.updateUI();
      this.updateBadge();
    }
  }

  async markAllAsRead() {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST'
      });

      this.markAllAsReadLocally();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  markAllAsReadLocally() {
    this.notifications.forEach(n => n.read = true);
    this.updateUI();
    this.updateBadge();
  }

  async dismiss(id) {
    try {
      await fetch(`/api/notifications/${id}/dismiss`, {
        method: 'POST'
      });

      this.removeNotificationLocally(id);
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  }

  removeNotificationLocally(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.updateUI();
    this.updateBadge();
  }

  async clearDismissed() {
    try {
      await fetch('/api/notifications/dismissed', {
        method: 'DELETE'
      });

      // Dismissed notifications are already removed locally
    } catch (error) {
      console.error('Failed to clear dismissed:', error);
    }
  }

  playNotificationSound() {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(error => {
      console.log('Could not play notification sound:', error);
    });
  }

  setupUI() {
    // Toggle notification panel
    const bellIcon = document.getElementById('notification-bell');
    const panel = document.getElementById('notification-panel');

    if (bellIcon && panel) {
      bellIcon.addEventListener('click', () => {
        panel.classList.toggle('open');
      });
    }

    // Mark all as read button
    const markAllBtn = document.getElementById('mark-all-read');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => this.markAllAsRead());
    }

    // Clear dismissed button
    const clearBtn = document.getElementById('clear-dismissed');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearDismissed());
    }
  }
}

// Initialize on page load
let notificationManager;
document.addEventListener('DOMContentLoaded', () => {
  notificationManager = new NotificationManager();
});
```

### 2. HTML Updates

```html
<!-- Add to header in src/public/index.html -->
<header>
  <h1>Assistive T140 Admin</h1>
  <nav>
    <ul>
      <li><a href="#" class="active" data-page="devices">Devices</a></li>
      <li><a href="#" data-page="llm">LLM Chat</a></li>
      <li><a href="#" data-page="settings">Settings</a></li>
    </ul>
  </nav>

  <!-- Notification Bell -->
  <div class="notification-container">
    <button id="notification-bell" class="notification-bell">
      🔔
      <span id="notification-badge" class="notification-badge" style="display: none;">0</span>
    </button>

    <!-- Notification Panel -->
    <div id="notification-panel" class="notification-panel">
      <div class="notification-panel-header">
        <h3>Notifications</h3>
        <div class="notification-panel-actions">
          <button id="mark-all-read" class="icon-btn" title="Mark all as read">✓</button>
          <button id="clear-dismissed" class="icon-btn" title="Clear dismissed">🗑️</button>
        </div>
      </div>
      <div id="notification-list" class="notification-list">
        <!-- Notifications will be rendered here -->
      </div>
    </div>
  </div>
</header>

<!-- Toast Container -->
<div id="toast-container" class="toast-container"></div>
```

### 3. CSS Styling

```css
/* src/public/css/notifications.css */

/* Notification Bell */
.notification-container {
  position: relative;
}

.notification-bell {
  position: relative;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
}

.notification-badge {
  position: absolute;
  top: 0;
  right: 0;
  background-color: var(--danger-color);
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 0.7rem;
  font-weight: bold;
  min-width: 18px;
  text-align: center;
}

/* Notification Panel */
.notification-panel {
  position: absolute;
  top: 100%;
  right: 0;
  width: 400px;
  max-height: 600px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: none;
  flex-direction: column;
  z-index: 1000;
}

.notification-panel.open {
  display: flex;
}

.notification-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.notification-panel-actions {
  display: flex;
  gap: 0.5rem;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  max-height: 500px;
}

/* Notification Item */
.notification-item {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s;
}

.notification-item:hover {
  background-color: #f5f5f5;
}

.notification-item.unread {
  background-color: #f0f8ff;
}

.notification-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.notification-time {
  font-size: 0.75rem;
  color: var(--text-light);
}

.notification-message {
  font-size: 0.9rem;
  color: var(--text-color);
  margin-bottom: 0.5rem;
}

.notification-action {
  display: inline-block;
  color: var(--primary-color);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
}

.notification-action:hover {
  text-decoration: underline;
}

.notification-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.notification-actions button {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.notification-actions button:hover {
  background-color: #f0f0f0;
}

/* Toast Notifications */
.toast-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast {
  width: 350px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-fade-out {
  animation: fadeOut 0.3s ease-out;
}

@keyframes fadeOut {
  to {
    opacity: 0;
    transform: translateX(400px);
  }
}

.toast-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.toast-icon {
  font-size: 1.25rem;
}

.toast-close {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-light);
}

.toast-body {
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
}

.toast-action {
  display: inline-block;
  margin-top: 0.5rem;
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

/* Toast Level Colors */
.toast-info {
  border-left: 4px solid #3498db;
}

.toast-success {
  border-left: 4px solid #2ecc71;
}

.toast-warning {
  border-left: 4px solid #f39c12;
}

.toast-error {
  border-left: 4px solid #e74c3c;
}

.toast-critical {
  border-left: 4px solid #c0392b;
  background-color: #ffe6e6;
}
```

---

## Environment Configuration

```env
# Notification settings
NOTIFICATION_SOUND_ENABLED=true
NOTIFICATION_HISTORY_LIMIT=100

# Push notification services (optional)
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_API_KEY=your_onesignal_api_key

# Firebase Cloud Messaging (optional)
FCM_SERVER_KEY=your_fcm_server_key
```

---

## Testing

```typescript
// tests/notification.service.test.ts
describe('NotificationService', () => {
  let service: NotificationService;
  let wsManager: WebSocketManager;

  beforeEach(() => {
    wsManager = new WebSocketManager(mockServer);
    service = new NotificationService(wsManager);
  });

  it('should create notification', () => {
    const notification = service.notify(
      'Test',
      'Test message',
      NotificationLevel.INFO,
      NotificationCategory.SYSTEM
    );

    expect(notification.title).toBe('Test');
    expect(notification.message).toBe('Test message');
    expect(notification.read).toBe(false);
  });

  it('should mark notification as read', () => {
    const notification = service.notify(
      'Test',
      'Test message',
      NotificationLevel.INFO,
      NotificationCategory.SYSTEM
    );

    const success = service.markAsRead(notification.id);

    expect(success).toBe(true);
    expect(notification.read).toBe(true);
  });

  it('should get unread count', () => {
    service.notify('Test 1', 'Message 1', NotificationLevel.INFO, NotificationCategory.SYSTEM);
    service.notify('Test 2', 'Message 2', NotificationLevel.INFO, NotificationCategory.SYSTEM);

    expect(service.getUnreadCount()).toBe(2);
  });
});
```

---

## Roadmap

### Phase 1 (Current)
- ✅ In-app toast notifications
- ✅ Notification panel
- ✅ WebSocket real-time updates
- ✅ Browser notifications
- ✅ Unread badge

### Phase 2 (Next)
- Email notifications for critical alerts
- SMS notifications (Twilio integration)
- Slack/Discord webhooks
- Notification preferences/filtering

### Phase 3 (Future)
- Mobile push notifications
- Notification scheduling
- Custom notification rules
- Analytics dashboard

---

Perfect! Now let me commit these comprehensive integration documents and create a summary for you.