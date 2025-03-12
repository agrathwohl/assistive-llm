/**
 * Interface representing an assistive device
 */
export interface AssistiveDevice {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  port: number;
  protocol: 'rtp' | 'websocket';
  status: DeviceStatus;
  lastConnected?: Date;
  createdAt: Date;
  updatedAt: Date;
  settings: DeviceSettings;
}

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
  customSettings?: Record<string, any>; // Any additional device-specific settings
}

/**
 * Transport interface for t140llm WebSocket connections
 */
export interface T140WebSocketConnection {
  send(data: string): void;
  close(): void;
  on(event: string, callback: Function): any;
  attachStream?(stream: any, options?: { processBackspaces?: boolean }): void;
}

/**
 * Transport interface for t140llm RTP connections
 */
export interface T140RtpTransport {
  sendText(text: string): void;
  close(): void;
  on(event: string, callback: Function): any;
  attachStream(stream: any, options?: { processBackspaces?: boolean }): void;
}

/**
 * Device connection information
 */
export interface DeviceConnection {
  device: AssistiveDevice;
  transport: T140WebSocketConnection | T140RtpTransport;
  status: DeviceStatus;
  connectedAt: Date;
  disconnectedAt?: Date;
  error?: string;
}