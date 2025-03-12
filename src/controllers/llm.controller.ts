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
      const { prompt, provider } = req.body;
      
      // Validate request
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }
      
      // Start streaming
      const success = await this.llmService.streamToDevice(
        deviceId,
        prompt,
        provider
      );
      
      if (!success) {
        res.status(400).json({ 
          error: 'Failed to stream to device. Device may not be connected or LLM provider is unavailable.' 
        });
        return;
      }
      
      res.json({ 
        message: `Started streaming LLM response to device: ${deviceId}`,
        provider: provider || 'default' 
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
      const { deviceIds, prompt, provider } = req.body;
      
      // Validate request
      if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
        res.status(400).json({ error: 'At least one device ID is required' });
        return;
      }
      
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }
      
      // Start streaming
      const results = await this.llmService.streamToMultipleDevices(
        deviceIds,
        prompt,
        provider
      );
      
      // Check if any stream was successful
      const anySuccess = results.some(result => result.success);
      
      if (!anySuccess) {
        res.status(400).json({ 
          error: 'Failed to stream to any device. Devices may not be connected or LLM provider is unavailable.',
          results 
        });
        return;
      }
      
      res.json({ 
        message: `Started streaming LLM response to devices`,
        results,
        provider: provider || 'default'
      });
    } catch (error: any) {
      logger.error('Error streaming to multiple devices:', error);
      res.status(500).json({ error: error.message });
    }
  };
}