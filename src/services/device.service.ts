import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// Import from local t140llm package
// Since this is a local package, we'll create our own type declarations
// and use require to avoid TypeScript errors
const t140llm = require('t140llm');
const { createT140WebSocketConnection, createT140RtpTransport } = t140llm;
import { 
  AssistiveDevice, 
  DeviceConnection, 
  DeviceStatus, 
  DeviceType, 
  T140RtpTransport,
  T140WebSocketConnection
} from '../interfaces/device.interface';
import { config } from '../config/config';
import { logger } from '../utils/logger';

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
    // Extract properties we don't want to update and keep the rest
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
      
      let transport;
      
      // Create transport based on protocol
      if (device.protocol === 'websocket') {
        const { connection } = createT140WebSocketConnection(
          `ws://${device.ipAddress}:${device.port}`
        );
        transport = connection;
      } else if (device.protocol === 'rtp') {
        const { transport: rtpTransport } = createT140RtpTransport(
          device.ipAddress,
          device.port,
          {
            charRateLimit: device.settings.characterRateLimit || config.t140.charRateLimit,
            processBackspaces: device.settings.backspaceProcessing !== undefined 
              ? device.settings.backspaceProcessing 
              : config.t140.defaultBackspaceProcessing
          }
        );
        transport = rtpTransport;
      } else {
        throw new Error(`Unsupported protocol: ${device.protocol}`);
      }
      
      // Create and store the connection
      const connection: DeviceConnection = {
        device: { ...device, status: DeviceStatus.ONLINE },
        transport,
        status: DeviceStatus.ONLINE,
        connectedAt: new Date()
      };
      
      activeConnections.set(id, connection);
      
      // Update device status to online and lastConnected
      await this.updateDevice(id, { 
        status: DeviceStatus.ONLINE,
        lastConnected: new Date()
      });
      
      logger.info(`Connected to device: ${device.name} (${id})`);
      return connection;
    } catch (error) {
      logger.error(`Error connecting to device ${id}:`, error);
      
      // Update device status to error
      await this.updateDevice(id, { 
        status: DeviceStatus.ERROR
      });
      
      return null;
    }
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
      if (connection.transport) {
        if (connection.device.protocol === 'websocket') {
          connection.transport.close();
        } else if (connection.device.protocol === 'rtp') {
          (connection.transport as T140RtpTransport).close();
        }
      }
      
      // Update connection status
      connection.status = DeviceStatus.OFFLINE;
      connection.disconnectedAt = new Date();
      
      // Remove from active connections
      activeConnections.delete(id);
      
      // Update device status
      await this.updateDevice(id, { status: DeviceStatus.OFFLINE });
      
      logger.info(`Disconnected from device: ${connection.device.name} (${id})`);
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