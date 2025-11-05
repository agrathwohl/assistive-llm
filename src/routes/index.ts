import { Router } from 'express';
import { deviceRouter } from './device.routes';
import { llmRouter } from './llm.routes';
import { notificationRouter } from './notification.routes';

const router = Router();

// API routes
router.use('/api/devices', deviceRouter);
router.use('/api/llm', llmRouter);
router.use('/api/notifications', notificationRouter);

export default router;