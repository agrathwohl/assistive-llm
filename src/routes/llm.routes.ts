import { Router } from 'express';
import { LLMController } from '../controllers/llm.controller';
import { LLMService } from '../services/llm.service';
import { deviceService } from './device.routes';

const router = Router();
const llmService = new LLMService(deviceService);
const llmController = new LLMController(llmService);

// GET available LLM providers
router.get('/providers', llmController.getProviders);

// POST stream to a specific device
router.post('/stream/:deviceId', llmController.streamToDevice);

// POST stream to multiple devices
router.post('/stream-multiple', llmController.streamToMultipleDevices);

export const llmRouter = router;