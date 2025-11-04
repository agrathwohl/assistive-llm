import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConversationMessage, StreamMetadata } from '../interfaces/device.interface';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * Service for managing conversation history
 */
export class ConversationService {
  private conversations: Map<string, ConversationMessage[]> = new Map();
  private streamMetadata: Map<string, StreamMetadata> = new Map();
  private conversationsPath: string;

  constructor() {
    this.conversationsPath = path.join(process.cwd(), config.database.path, 'conversations.json');
    this.loadConversations();
  }

  /**
   * Load conversations from disk
   */
  private async loadConversations(): Promise<void> {
    try {
      if (fs.existsSync(this.conversationsPath)) {
        const data = await fs.promises.readFile(this.conversationsPath, 'utf-8');
        const saved = JSON.parse(data);

        // Convert back to Map
        Object.keys(saved).forEach(key => {
          this.conversations.set(key, saved[key]);
        });

        logger.info(`Loaded ${this.conversations.size} conversation histories`);
      }
    } catch (error) {
      logger.error('Error loading conversations:', error);
    }
  }

  /**
   * Save conversations to disk
   */
  private async saveConversations(): Promise<void> {
    if (!config.llm.saveConversations) {
      return;
    }

    try {
      // Convert Map to object for JSON serialization
      const toSave: Record<string, ConversationMessage[]> = {};
      this.conversations.forEach((messages, conversationId) => {
        toSave[conversationId] = messages;
      });

      await fs.promises.writeFile(
        this.conversationsPath,
        JSON.stringify(toSave, null, 2)
      );
    } catch (error) {
      logger.error('Error saving conversations:', error);
    }
  }

  /**
   * Create a new conversation
   */
  createConversation(deviceIds: string[]): string {
    const conversationId = uuidv4();
    this.conversations.set(conversationId, []);
    logger.info(`Created new conversation: ${conversationId} for devices: ${deviceIds.join(', ')}`);
    return conversationId;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    conversationId: string,
    message: Omit<ConversationMessage, 'id' | 'timestamp'>
  ): Promise<ConversationMessage> {
    const fullMessage: ConversationMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date()
    };

    let messages = this.conversations.get(conversationId);
    if (!messages) {
      messages = [];
      this.conversations.set(conversationId, messages);
    }

    messages.push(fullMessage);

    // Trim history if it exceeds max length
    if (messages.length > config.llm.maxHistoryLength) {
      messages.splice(0, messages.length - config.llm.maxHistoryLength);
    }

    await this.saveConversations();
    logger.debug(`Added message to conversation ${conversationId}`);

    return fullMessage;
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId: string): ConversationMessage[] {
    return this.conversations.get(conversationId) || [];
  }

  /**
   * Get all conversations
   */
  getAllConversations(): Map<string, ConversationMessage[]> {
    return this.conversations;
  }

  /**
   * Clear a conversation
   */
  async clearConversation(conversationId: string): Promise<boolean> {
    const deleted = this.conversations.delete(conversationId);
    if (deleted) {
      await this.saveConversations();
      logger.info(`Cleared conversation: ${conversationId}`);
    }
    return deleted;
  }

  /**
   * Record stream metadata
   */
  recordStreamStart(metadata: Omit<StreamMetadata, 'endTime'>): void {
    this.streamMetadata.set(metadata.messageId, metadata as StreamMetadata);
  }

  /**
   * Update stream metadata on completion
   */
  recordStreamEnd(
    messageId: string,
    endData: { endTime: Date; tokensUsed?: number; error?: string }
  ): void {
    const metadata = this.streamMetadata.get(messageId);
    if (metadata) {
      Object.assign(metadata, endData);
      logger.info(`Stream completed: ${messageId}`);
    }
  }

  /**
   * Get stream metadata
   */
  getStreamMetadata(messageId: string): StreamMetadata | undefined {
    return this.streamMetadata.get(messageId);
  }

  /**
   * Get recent conversations for a device
   */
  getDeviceConversations(deviceId: string, limit: number = 10): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    this.conversations.forEach(conversationMessages => {
      conversationMessages.forEach(msg => {
        if (msg.deviceIds && msg.deviceIds.includes(deviceId)) {
          messages.push(msg);
        }
      });
    });

    // Sort by timestamp descending and limit
    return messages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}
