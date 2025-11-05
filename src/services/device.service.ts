import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// Import from t140llm package
const t140llm = require('t140llm');
const {
  createT140WebSocketConnection,
  createT140RtpTransport,
  createT140SrtpTransport,
  createDirectSocketTransport,
  createSrtpKeysFromPassphrase
} = t140llm;

import {
  AssistiveDevice,
  DeviceConnection,
  DeviceStatus,
  DeviceType,
  T140Transport,
  RtpConfig,
  SrtpConfig,
  TransportProtocol
} from '../interfaces/device.interface';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';

// In-memory storage for active device connections
const activeConnections: Map<string, DeviceConnection> = new Map();

// Path to store device data
const dataPath = path.join(process.cwd(), config.database.path);

// Ensure data directory exists
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

const devicesFilePath = path.join(dataPath, 'devices.json');

/**
 * Service to manage assistive devices
 */
export class DeviceService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Get all registered devices
   */
  async getAllDevices(): Promise<AssistiveDevice[]> {
    try {
      if (!fs.existsSync(devicesFilePath)) {
        return [];
      }

      const data = await fs.promises.readFile(devicesFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error getting devices:', error);
      return [];
    }
  }

  /**
   * Get a specific device by ID
   */
  async getDeviceById(id: string): Promise<AssistiveDevice | null> {
    const devices = await this.getAllDevices();
    const device = devices.find(d => d.id === id);
    return device || null;
  }

  /**
   * Add a new assistive device
   */
  async addDevice(deviceData: Omit<AssistiveDevice, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<AssistiveDevice> {
    const devices = await this.getAllDevices();

    const newDevice: AssistiveDevice = {
      ...deviceData,
      id: uuidv4(),
      status: DeviceStatus.OFFLINE,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    devices.push(newDevice);

    await fs.promises.writeFile(devicesFilePath, JSON.stringify(devices, null, 2));
    logger.info(`Added new device: ${newDevice.name} (${newDevice.id})`);

    return newDevice;
  }

  /**
   * Update an existing device
   */
  async updateDevice(id: string, updateData: Partial<AssistiveDevice>): Promise<AssistiveDevice | null> {
    const devices = await this.getAllDevices();
    const deviceIndex = devices.findIndex(d => d.id === id);

    if (deviceIndex === -1) {
      return null;
    }

    // Prevent updating immutable properties
    const validUpdateData = { ...updateData };
    delete (validUpdateData as any).id;
    delete (validUpdateData as any).createdAt;

    devices[deviceIndex] = {
      ...devices[deviceIndex],
      ...validUpdateData,
      updatedAt: new Date()
    };

    await fs.promises.writeFile(devicesFilePath, JSON.stringify(devices, null, 2));
    logger.info(`Updated device: ${devices[deviceIndex].name} (${id})`);

    return devices[deviceIndex];
  }

  /**
   * Delete a device
   */
  async deleteDevice(id: string): Promise<boolean> {
    const devices = await this.getAllDevices();
    const initialCount = devices.length;
    const updatedDevices = devices.filter(d => d.id !== id);

    if (updatedDevices.length === initialCount) {
      return false;
    }

    // If device is connected, disconnect it first
    if (activeConnections.has(id)) {
      await this.disconnectDevice(id);
    }

    await fs.promises.writeFile(devicesFilePath, JSON.stringify(updatedDevices, null, 2));
    logger.info(`Deleted device with ID: ${id}`);

    return true;
  }

  /**
   * Connect to a device
   */
  async connectDevice(id: string): Promise<DeviceConnection | null> {
    const device = await this.getDeviceById(id);

    if (!device) {
      logger.error(`Device not found: ${id}`);
      return null;
    }

    // If already connected, return the existing connection
    if (activeConnections.has(id)) {
      return activeConnections.get(id) || null;
    }

    try {
      // Update device status to connecting
      await this.updateDevice(id, { status: DeviceStatus.CONNECTING });

      let transport: T140Transport;

      // Create transport based on protocol
      switch (device.protocol) {
        case 'websocket':
          transport = await this.createWebSocketTransport(device);
          break;

        case 'rtp':
          transport = await this.createRtpTransport(device);
          break;

        case 'srtp':
          transport = await this.createSrtpTransport(device);
          break;

        case 'unix-stream':
        case 'unix-seqpacket':
          transport = await this.createUnixSocketTransport(device);
          break;

        default:
          throw new Error(`Unsupported protocol: ${device.protocol}`);
      }

      // Create and store the connection
      const connection: DeviceConnection = {
        device: { ...device, status: DeviceStatus.ONLINE },
        transport,
        status: DeviceStatus.ONLINE,
        connectedAt: new Date(),
        conversationHistory: []
      };

      activeConnections.set(id, connection);

      // Update device status to online and lastConnected
      await this.updateDevice(id, {
        status: DeviceStatus.ONLINE,
        lastConnected: new Date()
      });

      logger.info(`Connected to device: ${device.name} (${id}) via ${device.protocol}`);

      // Send notification
      await this.notificationService.notifyDeviceConnected(id, device.name);

      return connection;
    } catch (error) {
      logger.error(`Error connecting to device ${id}:`, error);

      // Update device status to error
      await this.updateDevice(id, {
        status: DeviceStatus.ERROR
      });

      // Send error notification
      await this.notificationService.notifyDeviceError(
        id,
        device.name,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return null;
    }
  }

  /**
   * Create WebSocket transport
   */
  private async createWebSocketTransport(device: AssistiveDevice): Promise<T140Transport> {
    const { connection } = createT140WebSocketConnection(
      `ws://${device.ipAddress}:${device.port}`,
      {
        charRateLimit: device.settings.characterRateLimit || config.t140.charRateLimit,
        processBackspaces: device.settings.backspaceProcessing !== undefined
          ? device.settings.backspaceProcessing
          : config.t140.defaultBackspaceProcessing
      }
    );

    return connection;
  }

  /**
   * Create RTP transport
   */
  private async createRtpTransport(device: AssistiveDevice): Promise<T140Transport> {
    const rtpConfig: RtpConfig = {
      charRateLimit: device.settings.characterRateLimit || config.t140.charRateLimit,
      processBackspaces: device.settings.backspaceProcessing !== undefined
        ? device.settings.backspaceProcessing
        : config.t140.defaultBackspaceProcessing,
      enableFEC: device.settings.enableFEC ?? config.t140.enableFEC,
      enableRED: device.settings.enableRED ?? config.t140.enableRED,
      redundancyGenerations: device.settings.redundancyGenerations ?? config.t140.redundancyGenerations
    };

    const { transport } = createT140RtpTransport(
      device.ipAddress,
      device.port,
      rtpConfig
    );

    return transport;
  }

  /**
   * Create SRTP transport
   */
  private async createSrtpTransport(device: AssistiveDevice): Promise<T140Transport> {
    let srtpKeys: { masterKey: string; masterSalt: string };

    // Generate keys from passphrase or use provided keys
    if (device.settings.srtpPassphrase) {
      srtpKeys = createSrtpKeysFromPassphrase(device.settings.srtpPassphrase);
    } else if (device.settings.srtpKey && device.settings.srtpSalt) {
      srtpKeys = {
        masterKey: device.settings.srtpKey,
        masterSalt: device.settings.srtpSalt
      };
    } else {
      throw new Error('SRTP requires either a passphrase or key/salt combination');
    }

    const srtpConfig: SrtpConfig = {
      masterKey: srtpKeys.masterKey,
      masterSalt: srtpKeys.masterSalt,
      charRateLimit: device.settings.characterRateLimit || config.t140.charRateLimit,
      processBackspaces: device.settings.backspaceProcessing !== undefined
        ? device.settings.backspaceProcessing
        : config.t140.defaultBackspaceProcessing,
      enableFEC: device.settings.enableFEC ?? config.t140.enableFEC,
      enableRED: device.settings.enableRED ?? config.t140.enableRED,
      redundancyGenerations: device.settings.redundancyGenerations ?? config.t140.redundancyGenerations
    };

    const { transport } = createT140SrtpTransport(
      device.ipAddress,
      srtpConfig,
      device.port
    );

    return transport;
  }

  /**
   * Create Unix socket transport
   */
  private async createUnixSocketTransport(device: AssistiveDevice): Promise<T140Transport> {
    const socketPath = device.settings.socketPath || `/tmp/t140-${device.id}.sock`;

    const rtpConfig: RtpConfig = {
      charRateLimit: device.settings.characterRateLimit || config.t140.charRateLimit,
      processBackspaces: device.settings.backspaceProcessing !== undefined
        ? device.settings.backspaceProcessing
        : config.t140.defaultBackspaceProcessing,
      enableFEC: device.settings.enableFEC ?? config.t140.enableFEC,
      enableRED: device.settings.enableRED ?? config.t140.enableRED,
      redundancyGenerations: device.settings.redundancyGenerations ?? config.t140.redundancyGenerations
    };

    const { transport } = createDirectSocketTransport(socketPath, rtpConfig);

    return transport;
  }

  /**
   * Disconnect from a device
   */
  async disconnectDevice(id: string): Promise<boolean> {
    const connection = activeConnections.get(id);

    if (!connection) {
      logger.warn(`No active connection found for device: ${id}`);
      return false;
    }

    try {
      // Close the transport connection
      if (connection.transport && connection.transport.close) {
        connection.transport.close();
      }

      // Update connection status
      connection.status = DeviceStatus.OFFLINE;
      connection.disconnectedAt = new Date();

      // Remove from active connections
      activeConnections.delete(id);

      // Update device status
      await this.updateDevice(id, { status: DeviceStatus.OFFLINE });

      logger.info(`Disconnected from device: ${connection.device.name} (${id})`);

      // Send notification
      await this.notificationService.notifyDeviceDisconnected(id, connection.device.name);

      return true;
    } catch (error) {
      logger.error(`Error disconnecting from device ${id}:`, error);
      return false;
    }
  }

  /**
   * Get all active device connections
   */
  getActiveConnections(): DeviceConnection[] {
    return Array.from(activeConnections.values());
  }

  /**
   * Get a specific active connection by device ID
   */
  getActiveConnection(id: string): DeviceConnection | null {
    return activeConnections.get(id) || null;
  }
}
