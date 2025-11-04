import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  AssistiveDevice,
  DeviceConnection,
  ConversationMessage,
  StreamMetadata,
  T140Transport
} from '../interfaces/device.interface';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { DeviceService } from './device.service';
import { ConversationService } from './conversation.service';

/**
 * Service for handling LLM interactions and streaming to assistive devices
 */
export class LLMService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private deviceService: DeviceService;
  private conversationService: ConversationService;
  private activeStreams: Map<string, { conversationId: string; messageId: string }> = new Map();

  constructor(deviceService: DeviceService, conversationService: ConversationService) {
    this.deviceService = deviceService;
    this.conversationService = conversationService;
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
  getProvidersStatus(): { provider: string; available: boolean; model: string }[] {
    return [
      {
        provider: 'openai',
        available: !!this.openai,
        model: config.llm.openai.model
      },
      {
        provider: 'anthropic',
        available: !!this.anthropic,
        model: config.llm.anthropic.model
      }
    ];
  }

  /**
   * Stream LLM response to a specific device using native t140llm API
   */
  async streamToDevice(
    deviceId: string,
    prompt: string,
    provider: 'openai' | 'anthropic' = config.llm.defaultProvider as 'openai' | 'anthropic',
    conversationHistory?: ConversationMessage[]
  ): Promise<{ success: boolean; conversationId: string; messageId: string; error?: string }> {
    const connection = this.deviceService.getActiveConnection(deviceId);

    if (!connection) {
      const error = `Cannot stream to device ${deviceId}: Device not connected`;
      logger.error(error);
      return { success: false, conversationId: '', messageId: '', error };
    }

    const conversationId = this.conversationService.createConversation([deviceId]);
    const messageId = uuidv4();

    // Add user message
    await this.conversationService.addMessage(conversationId, {
      role: 'user',
      content: prompt,
      deviceIds: [deviceId],
      provider,
      model: provider === 'openai' ? config.llm.openai.model : config.llm.anthropic.model
    });

    this.conversationService.recordStreamStart({
      conversationId,
      messageId,
      deviceIds: [deviceId],
      provider,
      model: provider === 'openai' ? config.llm.openai.model : config.llm.anthropic.model,
      prompt,
      startTime: new Date()
    });

    try {
      const messages = this.buildMessagesArray(prompt, conversationHistory);
      let stream;

      if (provider === 'openai' && this.openai) {
        stream = await this.getOpenAIStream(messages);
      } else if (provider === 'anthropic' && this.anthropic) {
        stream = await this.getAnthropicStream(messages);
      } else {
        throw new Error(`Provider ${provider} not available`);
      }

      // Use t140llm's native attachStream method if available
      if (connection.transport.attachStream) {
        await connection.transport.attachStream(stream, {
          processBackspaces: connection.device.settings.backspaceProcessing ?? true,
          charRateLimit: connection.device.settings.characterRateLimit ?? config.t140.charRateLimit,
          enableFEC: connection.device.settings.enableFEC ?? config.t140.enableFEC,
          enableRED: connection.device.settings.enableRED ?? config.t140.enableRED,
          redundancyGenerations: connection.device.settings.redundancyGenerations ?? config.t140.redundancyGenerations
        });

        logger.info(`Stream attached to device ${deviceId} using native t140llm API`);
      }

      // Record completion
      this.conversationService.recordStreamEnd(messageId, {
        endTime: new Date()
      });

      return { success: true, conversationId, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error streaming to device ${deviceId}:`, error);

      this.conversationService.recordStreamEnd(messageId, {
        endTime: new Date(),
        error: errorMessage
      });

      return { success: false, conversationId, messageId, error: errorMessage };
    }
  }

  /**
   * Stream LLM response to multiple devices
   */
  async streamToMultipleDevices(
    deviceIds: string[],
    prompt: string,
    provider: 'openai' | 'anthropic' = config.llm.defaultProvider as 'openai' | 'anthropic',
    conversationHistory?: ConversationMessage[]
  ): Promise<{ success: boolean; conversationId: string; messageId: string; error?: string; results?: { deviceId: string; success: boolean }[] }> {
    const conversationId = this.conversationService.createConversation(deviceIds);
    const messageId = uuidv4();

    // Add user message to conversation
    await this.conversationService.addMessage(conversationId, {
      role: 'user',
      content: prompt,
      deviceIds,
      provider,
      model: provider === 'openai' ? config.llm.openai.model : config.llm.anthropic.model
    });

    // Record stream metadata
    this.conversationService.recordStreamStart({
      conversationId,
      messageId,
      deviceIds,
      provider,
      model: provider === 'openai' ? config.llm.openai.model : config.llm.anthropic.model,
      prompt,
      startTime: new Date()
    });

    try {
      // Get connections for all devices
      const results: { deviceId: string; success: boolean }[] = [];

      for (const deviceId of deviceIds) {
        const result = await this.streamToDevice(deviceId, prompt, provider, conversationHistory);
        results.push({ deviceId, success: result.success });
      }

      // Record completion
      this.conversationService.recordStreamEnd(messageId, {
        endTime: new Date()
      });

      const allSuccess = results.every(r => r.success);

      return {
        success: allSuccess,
        conversationId,
        messageId,
        results
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error streaming to devices:`, error);

      this.conversationService.recordStreamEnd(messageId, {
        endTime: new Date(),
        error: errorMessage
      });

      return { success: false, conversationId, messageId, error: errorMessage };
    }
  }

  /**
   * Build messages array from prompt and history
   */
  private buildMessagesArray(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      });
    }

    // Add current prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    return messages;
  }

  /**
   * Get a streaming response from OpenAI
   */
  private async getOpenAIStream(messages: Array<{ role: string; content: string }>): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const stream = await this.openai.chat.completions.create({
      model: config.llm.openai.model,
      messages: messages as any,
      stream: true
    });

    return stream;
  }

  /**
   * Get a streaming response from Anthropic
   */
  private async getAnthropicStream(messages: Array<{ role: string; content: string }>): Promise<any> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const stream = await this.anthropic.messages.create({
      model: config.llm.anthropic.model,
      messages: messages as any,
      max_tokens: 4000,
      stream: true
    });

    return stream;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(conversationId: string): ConversationMessage[] {
    return this.conversationService.getConversation(conversationId);
  }

  /**
   * Get device conversations
   */
  getDeviceConversations(deviceId: string, limit?: number): ConversationMessage[] {
    return this.conversationService.getDeviceConversations(deviceId, limit);
  }

  /**
   * Clear conversation history
   */
  async clearConversation(conversationId: string): Promise<boolean> {
    return this.conversationService.clearConversation(conversationId);
  }
}
