import express from 'express';
import expressWs from 'express-ws';
import path from 'path';
import fs from 'fs';
import * as WebSocket from 'ws';
import { config } from './config/config';
import { logger, logStream } from './utils/logger';
import routes from './routes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { DeviceService } from './services/device.service';
import { Notification } from './interfaces/notification.interface';

// Get the express-ws augmented app type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app = express() as any;
const wsInstance = expressWs(app);

// Initialize services
const deviceService = new DeviceService();
const conversationService = new (require('./services/conversation.service').ConversationService)();
const notificationService = new (require('./services/notification.service').NotificationService)();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/', routes);

// Track all admin WebSocket connections for broadcasting
const adminConnections = new Set<WebSocket.WebSocket>();

// WebSocket endpoint for admin console updates
app.ws('/ws/admin', (ws: WebSocket.WebSocket, req: express.Request) => {
  logger.info('Assistive LLM: Admin console connected via WebSocket');

  // Add to connection pool
  adminConnections.add(ws);

  // Send initial data
  const sendInitialData = async () => {
    try {
      const devices = await deviceService.getAllDevices();
      const connections = deviceService.getActiveConnections().map(conn => ({
        deviceId: conn.device.id,
        deviceName: conn.device.name,
        status: conn.status,
        connectedAt: conn.connectedAt
      }));

      // Get recent notifications
      const notifications = notificationService.getNotifications();
      const unreadCount = notificationService.getUnreadCount();

      ws.send(JSON.stringify({
        type: 'initial_data',
        data: { devices, connections, notifications, unreadCount }
      }));
    } catch (error) {
      logger.error('Error sending initial data to admin console:', error);
    }
  };

  sendInitialData();

  // Handle connection close
  ws.on('close', () => {
    logger.info('Assistive LLM: Admin console disconnected');
    adminConnections.delete(ws);
  });
});

// Broadcast notifications to all connected admin clients
notificationService.onNotification((notification: Notification) => {
  const message = JSON.stringify({
    type: 'notification',
    data: notification
  });

  adminConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, async () => {
  logger.info(`Assistive LLM: Server running at http://${HOST}:${PORT}`);
  logger.info(`Assistive LLM: Admin interface available at http://${HOST}:${PORT}`);

  // Send system startup notification
  await notificationService.notifySystemStartup();
});