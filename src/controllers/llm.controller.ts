import { Request, Response } from 'express';
import { LLMService } from '../services/llm.service';
import { logger } from '../utils/logger';

/**
 * Controller for handling LLM-related API endpoints
 */
export class LLMController {
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * Get available LLM providers
   */
  getProviders = (req: Request, res: Response): void => {
    try {
      const providers = this.llmService.getProvidersStatus();
      res.json(providers);
    } catch (error: any) {
      logger.error('Error getting LLM providers:', error);
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Stream LLM response to a device
   */
  streamToDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { prompt, provider, conversationId } = req.body;

      // Validate request
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      // Get conversation history if conversationId provided
      let conversationHistory;
      if (conversationId) {
        conversationHistory = this.llmService.getConversationHistory(conversationId);
      }

      // Start streaming
      const result = await this.llmService.streamToDevice(
        deviceId,
        prompt,
        provider,
        conversationHistory
      );

      if (!result.success) {
        res.status(400).json({
          error: result.error || 'Failed to stream to device',
          conversationId: result.conversationId,
          messageId: result.messageId
        });
        return;
      }

      res.json({
        message: `Started streaming LLM response to device: ${deviceId}`,
        provider: provider || 'default',
        conversationId: result.conversationId,
        messageId: result.messageId
      });
    } catch (error: any) {
      logger.error(`Error streaming to device ${req.params.deviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Stream LLM response to multiple devices
   */
  streamToMultipleDevices = async (req: Request, res: Response): Promise<void> => {
    try {
      const { deviceIds, prompt, provider, conversationId } = req.body;

      // Validate request
      if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
        res.status(400).json({ error: 'At least one device ID is required' });
        return;
      }

      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      // Get conversation history if conversationId provided
      let conversationHistory;
      if (conversationId) {
        conversationHistory = this.llmService.getConversationHistory(conversationId);
      }

      // Start streaming
      const result = await this.llmService.streamToMultipleDevices(
        deviceIds,
        prompt,
        provider,
        conversationHistory
      );

      if (!result.success) {
        res.status(400).json({
          error: result.error || 'Failed to stream to devices',
          results: result.results,
          conversationId: result.conversationId,
          messageId: result.messageId
        });
        return;
      }

      res.json({
        message: `Started streaming LLM response to devices`,
        results: result.results,
        provider: provider || 'default',
        conversationId: result.conversationId,
        messageId: result.messageId
      });
    } catch (error: any) {
      logger.error('Error streaming to multiple devices:', error);
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Get conversation history
   */
  getConversation = (req: Request, res: Response): void => {
    try {
      const { conversationId } = req.params;

      const history = this.llmService.getConversationHistory(conversationId);

      res.json({
        conversationId,
        messages: history
      });
    } catch (error: any) {
      logger.error('Error getting conversation history:', error);
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Get device conversations
   */
  getDeviceConversations = (req: Request, res: Response): void => {
    try {
      const { deviceId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const conversations = this.llmService.getDeviceConversations(deviceId, limit);

      res.json({
        deviceId,
        conversations
      });
    } catch (error: any) {
      logger.error('Error getting device conversations:', error);
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Clear conversation history
   */
  clearConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;

      const success = await this.llmService.clearConversation(conversationId);

      if (!success) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      res.json({ message: 'Conversation cleared successfully' });
    } catch (error: any) {
      logger.error('Error clearing conversation:', error);
      res.status(500).json({ error: error.message });
    }
  };
}
