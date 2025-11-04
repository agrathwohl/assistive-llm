import { Router } from 'express';
import { LLMController } from '../controllers/llm.controller';
import { LLMService } from '../services/llm.service';
import { ConversationService } from '../services/conversation.service';
import { deviceService } from './device.routes';

const router = Router();

// Initialize conversation service
const conversationService = new ConversationService();

// Initialize LLM service with both device and conversation services
const llmService = new LLMService(deviceService, conversationService);
const llmController = new LLMController(llmService);

// GET available LLM providers
router.get('/providers', llmController.getProviders);

// POST stream to a specific device
router.post('/stream/:deviceId', llmController.streamToDevice);

// POST stream to multiple devices
router.post('/stream-multiple', llmController.streamToMultipleDevices);

// GET conversation history
router.get('/conversations/:conversationId', llmController.getConversation);

// GET device conversations
router.get('/devices/:deviceId/conversations', llmController.getDeviceConversations);

// DELETE conversation
router.delete('/conversations/:conversationId', llmController.clearConversation);

export const llmRouter = router;
