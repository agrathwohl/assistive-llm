import { Request, Response } from 'express';
import { DeviceService } from '../services/device.service';
import { logger } from '../utils/logger';
import { AssistiveDevice, DeviceType } from '../interfaces/device.interface';

/**
 * Controller for handling device-related API endpoints
 */
export class DeviceController {
  private deviceService: DeviceService;
  
  constructor(deviceService: DeviceService) {
    this.deviceService = deviceService;
  }
  
  /**
   * Get all devices
   */
  getAllDevices = async (req: Request, res: Response): Promise<void> => {
    try {
      const devices = await this.deviceService.getAllDevices();
      res.json(devices);
    } catch (error: any) {
      logger.error('Error getting all devices:', error);
      res.status(500).json({ error: error.message });
    }
  };
  
  /**
   * Get device by ID
   */
  getDeviceById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const device = await this.deviceService.getDeviceById(id);
      
      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }
      
      res.json(device);
    } catch (error: any) {
      logger.error(`Error getting device ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  };
  
  /**
   * Add a new device
   */
  addDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, type, ipAddress, port, protocol, settings } = req.body;
      
      // Validate required fields
      if (!name || !type || !ipAddress || !port || !protocol) {
        res.status(400).json({ 
          error: 'Missing required fields: name, type, ipAddress, port, protocol' 
        });
        return;
      }
      
      // Validate device type
      if (!Object.values(DeviceType).includes(type)) {
        res.status(400).json({ 
          error: `Invalid device type. Must be one of: ${Object.values(DeviceType).join(', ')}` 
        });
        return;
      }
      
      // Validate protocol
      if (!['rtp', 'websocket'].includes(protocol)) {
        res.status(400).json({ 
          error: 'Invalid protocol. Must be either "rtp" or "websocket"' 
        });
        return;
      }
      
      const newDevice = await this.deviceService.addDevice({
        name,
        type,
        ipAddress,
        port,
        protocol,
        settings: settings || {}
      });
      
      res.status(201).json(newDevice);
    } catch (error: any) {
      logger.error('Error adding device:', error);
      res.status(500).json({ error: error.message });
    }
  };
  
  /**
   * Update a device
   */
  updateDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Prevent updating immutable fields
      if (updateData.id) {
        delete updateData.id;
      }
      
      const updatedDevice = await this.deviceService.updateDevice(id, updateData);
      
      if (!updatedDevice) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }
      
      res.json(updatedDevice);
    } catch (error: any) {
      logger.error(`Error updating device ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  };
  
  /**
   * Delete a device
   */
  deleteDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const deleted = await this.deviceService.deleteDevice(id);
      
      if (!deleted) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }
      
      res.status(204).end();
    } catch (error: any) {
      logger.error(`Error deleting device ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  };
  
  /**
   * Connect to a device
   */
  connectDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const connection = await this.deviceService.connectDevice(id);
      
      if (!connection) {
        res.status(400).json({ error: 'Failed to connect to device' });
        return;
      }
      
      res.json({
        message: `Connected to device: ${connection.device.name}`,
        status: connection.status,
        connectedAt: connection.connectedAt
      });
    } catch (error: any) {
      logger.error(`Error connecting to device ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  };
  
  /**
   * Disconnect from a device
   */
  disconnectDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const disconnected = await this.deviceService.disconnectDevice(id);
      
      if (!disconnected) {
        res.status(400).json({ error: 'Failed to disconnect from device or device not connected' });
        return;
      }
      
      res.json({ message: `Disconnected from device successfully` });
    } catch (error: any) {
      logger.error(`Error disconnecting from device ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  };
  
  /**
   * Get all active device connections
   */
  getActiveConnections = async (req: Request, res: Response): Promise<void> => {
    try {
      const connections = this.deviceService.getActiveConnections();
      
      // Map connections to a more response-friendly format
      const formattedConnections = connections.map(conn => ({
        deviceId: conn.device.id,
        deviceName: conn.device.name,
        status: conn.status,
        connectedAt: conn.connectedAt,
        disconnectedAt: conn.disconnectedAt,
        protocol: conn.device.protocol
      }));
      
      res.json(formattedConnections);
    } catch (error: any) {
      logger.error('Error getting active connections:', error);
      res.status(500).json({ error: error.message });
    }
  };
}