import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { 
  AssistiveDevice, 
  DeviceConnection, 
  T140WebSocketConnection, 
  T140RtpTransport 
} from '../interfaces/device.interface';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { DeviceService } from './device.service';

/**
 * Service for handling LLM interactions and streaming to assistive devices
 */
export class LLMService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private deviceService: DeviceService;
  
  constructor(deviceService: DeviceService) {
    this.deviceService = deviceService;
    this.initializeLLMClients();
  }
  
  /**
   * Initialize LLM clients based on configuration
   */
  private initializeLLMClients(): void {
    // Initialize OpenAI if API key is provided
    if (config.llm.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: config.llm.openai.apiKey
      });
      logger.info('OpenAI client initialized');
    } else {
      logger.warn('OpenAI API key not provided, client not initialized');
    }
    
    // Initialize Anthropic if API key is provided
    if (config.llm.anthropic.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.llm.anthropic.apiKey
      });
      logger.info('Anthropic client initialized');
    } else {
      logger.warn('Anthropic API key not provided, client not initialized');
    }
  }
  
  /**
   * Get status of LLM providers
   */
  getProvidersStatus(): { provider: string, available: boolean }[] {
    return [
      { provider: 'openai', available: !!this.openai },
      { provider: 'anthropic', available: !!this.anthropic }
    ];
  }
  
  /**
   * Stream LLM response to a specific device
   */
  async streamToDevice(
    deviceId: string, 
    prompt: string, 
    provider: 'openai' | 'anthropic' = config.llm.defaultProvider as 'openai' | 'anthropic'
  ): Promise<boolean> {
    // Get device connection
    const connection = this.deviceService.getActiveConnection(deviceId);
    
    if (!connection) {
      logger.error(`Cannot stream to device ${deviceId}: Device not connected`);
      return false;
    }
    
    try {
      // Get stream based on provider
      let stream;
      
      if (provider === 'openai' && this.openai) {
        stream = await this.getOpenAIStream(prompt);
      } else if (provider === 'anthropic' && this.anthropic) {
        stream = await this.getAnthropicStream(prompt);
      } else {
        throw new Error(`Provider ${provider} not available`);
      }
      
      // Attach stream to device transport
      this.attachStreamToDevice(stream, connection);
      
      logger.info(`Started streaming LLM response to device: ${connection.device.name} (${deviceId})`);
      return true;
    } catch (error) {
      logger.error(`Error streaming to device ${deviceId}:`, error);
      return false;
    }
  }
  
  /**
   * Stream LLM response to multiple devices
   */
  async streamToMultipleDevices(
    deviceIds: string[], 
    prompt: string, 
    provider: 'openai' | 'anthropic' = config.llm.defaultProvider as 'openai' | 'anthropic'
  ): Promise<{ deviceId: string, success: boolean }[]> {
    const results: { deviceId: string, success: boolean }[] = [];
    
    // Get stream based on provider
    let stream;
    
    try {
      if (provider === 'openai' && this.openai) {
        stream = await this.getOpenAIStream(prompt);
      } else if (provider === 'anthropic' && this.anthropic) {
        stream = await this.getAnthropicStream(prompt);
      } else {
        throw new Error(`Provider ${provider} not available`);
      }
      
      // Process each device
      for (const deviceId of deviceIds) {
        const connection = this.deviceService.getActiveConnection(deviceId);
        
        if (!connection) {
          logger.warn(`Cannot stream to device ${deviceId}: Device not connected`);
          results.push({ deviceId, success: false });
          continue;
        }
        
        try {
          // Clone the stream for each device
          // Note: This is a simplification - in a real implementation, we would need
          // to handle stream cloning more carefully based on the specific LLM provider
          this.attachStreamToDevice(stream, connection);
          results.push({ deviceId, success: true });
          logger.info(`Started streaming LLM response to device: ${connection.device.name} (${deviceId})`);
        } catch (error) {
          logger.error(`Error streaming to device ${deviceId}:`, error);
          results.push({ deviceId, success: false });
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Error getting LLM stream:', error);
      return deviceIds.map(deviceId => ({ deviceId, success: false }));
    }
  }
  
  /**
   * Get a streaming response from OpenAI
   */
  private async getOpenAIStream(prompt: string): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const stream = await this.openai.chat.completions.create({
      model: config.llm.openai.model,
      messages: [{ role: 'user', content: prompt }],
      stream: true
    });
    
    return stream;
  }
  
  /**
   * Get a streaming response from Anthropic
   */
  private async getAnthropicStream(prompt: string): Promise<any> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }
    
    const stream = await this.anthropic.messages.create({
      model: config.llm.anthropic.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      stream: true
    });
    
    return stream;
  }
  
  /**
   * Attach an LLM stream to a device transport
   */
  private attachStreamToDevice(stream: any, connection: DeviceConnection): void {
    // Get attach function based on protocol
    if (connection.device.protocol === 'websocket') {
      const transport = connection.transport as import('../interfaces/device.interface').T140WebSocketConnection;
      if (!transport.attachStream) {
        throw new Error('WebSocket transport does not have attachStream method');
      }
      transport.attachStream(stream, {
        processBackspaces: connection.device.settings.backspaceProcessing
      });
    } else if (connection.device.protocol === 'rtp') {
      const transport = connection.transport as import('../interfaces/device.interface').T140RtpTransport;
      transport.attachStream(stream, {
        processBackspaces: connection.device.settings.backspaceProcessing
      });
    } else {
      throw new Error(`Unsupported protocol: ${connection.device.protocol}`);
    }
  }
}