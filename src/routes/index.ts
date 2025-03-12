import { Router } from 'express';
import { deviceRouter } from './device.routes';
import { llmRouter } from './llm.routes';

const router = Router();

// API routes
router.use('/api/devices', deviceRouter);
router.use('/api/llm', llmRouter);

export default router;