import { Router } from 'express';
import { DeviceController } from '../controllers/device.controller';
import { DeviceService } from '../services/device.service';

const router = Router();
const deviceService = new DeviceService();
const deviceController = new DeviceController(deviceService);

// GET all devices
router.get('/', deviceController.getAllDevices);

// GET a specific device by ID
router.get('/:id', deviceController.getDeviceById);

// POST create a new device
router.post('/', deviceController.addDevice);

// PUT update a device
router.put('/:id', deviceController.updateDevice);

// DELETE a device
router.delete('/:id', deviceController.deleteDevice);

// POST connect to a device
router.post('/:id/connect', deviceController.connectDevice);

// POST disconnect from a device
router.post('/:id/disconnect', deviceController.disconnectDevice);

// GET all active connections
router.get('/connections/active', deviceController.getActiveConnections);

export const deviceRouter = router;
export { deviceService };