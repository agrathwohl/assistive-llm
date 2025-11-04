/**
 * Interface representing an assistive device
 */
export interface AssistiveDevice {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  port: number;
  protocol: TransportProtocol;
  status: DeviceStatus;
  lastConnected?: Date;
  createdAt: Date;
  updatedAt: Date;
  settings: DeviceSettings;
}

/**
 * Transport protocols supported by t140llm
 */
export type TransportProtocol = 'rtp' | 'srtp' | 'websocket' | 'unix-stream' | 'unix-seqpacket';

/**
 * Types of assistive devices supported by the application
 */
export enum DeviceType {
  HEARING_DEVICE = 'hearing',      // For deaf or hard of hearing users
  VISUAL_DEVICE = 'visual',        // For blind or low vision users
  MOBILITY_DEVICE = 'mobility',    // For users with mobility impairments
  COGNITIVE_DEVICE = 'cognitive',  // For users with cognitive disabilities
  MULTI_PURPOSE = 'multi'          // For devices that support multiple disability types
}

/**
 * Status of the assistive device
 */
export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
  ERROR = 'error'
}

/**
 * Settings specific to each device
 */
export interface DeviceSettings {
  characterRateLimit?: number;     // Maximum character rate (for hearing devices)
  backspaceProcessing?: boolean;   // Whether to process backspace characters
  textSize?: string;               // Font size for visual displays (small, medium, large)
  contrast?: string;               // Display contrast (standard, high)
  audioFeedback?: boolean;         // Whether to provide audio feedback

  // Advanced T.140 features
  enableFEC?: boolean;             // Enable Forward Error Correction
  enableRED?: boolean;             // Enable Redundancy
  redundancyGenerations?: number;  // Number of redundancy generations (1-3)

  // SRTP settings
  srtpKey?: string;                // SRTP master key (base64)
  srtpSalt?: string;               // SRTP salt (base64)
  srtpPassphrase?: string;         // SRTP passphrase (alternative to key/salt)

  // Unix socket settings
  socketPath?: string;             // Path to Unix socket

  customSettings?: Record<string, any>; // Any additional device-specific settings
}

/**
 * RTP Configuration for t140llm
 */
export interface RtpConfig {
  charRateLimit?: number;
  processBackspaces?: boolean;
  enableFEC?: boolean;
  enableRED?: boolean;
  redundancyGenerations?: number;
  ssrc?: number;
}

/**
 * SRTP Configuration for t140llm
 */
export interface SrtpConfig {
  masterKey: string;   // Base64 encoded
  masterSalt: string;  // Base64 encoded
  charRateLimit?: number;
  processBackspaces?: boolean;
  enableFEC?: boolean;
  enableRED?: boolean;
  redundancyGenerations?: number;
}

/**
 * Transport interface for t140llm connections
 */
export interface T140Transport {
  send?(data: string): void;
  sendText?(text: string): void;
  close(): void;
  on?(event: string, callback: Function): any;
  attachStream?(stream: any, options?: any): Promise<void> | void;
}

/**
 * Device connection information
 */
export interface DeviceConnection {
  device: AssistiveDevice;
  transport: T140Transport;
  status: DeviceStatus;
  connectedAt: Date;
  disconnectedAt?: Date;
  error?: string;
  conversationHistory?: ConversationMessage[];
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  provider?: string;
  model?: string;
  deviceIds?: string[];
  metadata?: Record<string, any>;
}

/**
 * Stream metadata
 */
export interface StreamMetadata {
  conversationId: string;
  messageId: string;
  deviceIds: string[];
  provider: string;
  model: string;
  prompt: string;
  startTime: Date;
  endTime?: Date;
  tokensUsed?: number;
  error?: string;
}
