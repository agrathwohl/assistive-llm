/**
 * Assistive T140 Admin Interface
 */

// DOM Elements
const deviceList = document.getElementById('device-list');
const connectionList = document.getElementById('connection-list');
const addDeviceBtn = document.getElementById('add-device-btn');
const deviceModal = document.getElementById('device-modal');
const deviceForm = document.getElementById('device-form');
const closeBtn = document.querySelector('.close-btn');
const cancelBtn = document.querySelector('.cancel-btn');
const targetDevices = document.getElementById('target-devices');
const llmProvider = document.getElementById('llm-provider');
const promptInput = document.getElementById('prompt-input');
const sendPromptBtn = document.getElementById('send-prompt-btn');
const llmStatusDisplay = document.getElementById('llm-status-display');
const navLinks = document.querySelectorAll('nav a');
const pages = document.querySelectorAll('.page');

// API endpoints
const API = {
  devices: '/api/devices',
  connections: '/api/devices/connections/active',
  llmProviders: '/api/llm/providers',
  streamToDevice: '/api/llm/stream',
  streamToMultiple: '/api/llm/stream-multiple'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Load initial data
  fetchDevices();
  fetchConnections();
  fetchLLMProviders();
  
  // Set up event listeners
  setupNavigation();
  setupDeviceModal();
  setupLLMControls();
});

// Navigation
function setupNavigation() {
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = link.getAttribute('data-page');
      
      // Update active states
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      pages.forEach(page => {
        if (page.id === `${targetPage}-page`) {
          page.classList.add('active');
        } else {
          page.classList.remove('active');
        }
      });
    });
  });
}

// Device Management
async function fetchDevices() {
  try {
    deviceList.innerHTML = '<div class="loading">Loading devices...</div>';
    
    const response = await fetch(API.devices);
    const devices = await response.json();
    
    if (devices.length === 0) {
      deviceList.innerHTML = '<div class="card"><p>No devices registered. Add your first device to get started.</p></div>';
      return;
    }
    
    deviceList.innerHTML = '';
    devices.forEach(device => {
      deviceList.appendChild(createDeviceCard(device));
    });
    
    // Update device options in the LLM panel
    updateDeviceOptions(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    deviceList.innerHTML = '<div class="card"><p>Error loading devices. Please try again.</p></div>';
  }
}

function createDeviceCard(device) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = device.id;
  
  const statusClass = `status-${device.status.toLowerCase()}`;
  
  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${device.name}</h3>
      <span class="status-badge ${statusClass}">${device.status}</span>
    </div>
    <div class="card-body">
      <p><strong>Type:</strong> ${device.type}</p>
      <p><strong>Address:</strong> ${device.ipAddress}:${device.port}</p>
      <p><strong>Protocol:</strong> ${device.protocol}</p>
      <p><strong>Last Connected:</strong> ${device.lastConnected ? new Date(device.lastConnected).toLocaleString() : 'Never'}</p>
    </div>
    <div class="card-actions">
      ${device.status === 'ONLINE' ? 
        `<button class="secondary-btn disconnect-btn" data-id="${device.id}">Disconnect</button>` : 
        `<button class="primary-btn connect-btn" data-id="${device.id}">Connect</button>`
      }
      <button class="secondary-btn edit-btn" data-id="${device.id}">Edit</button>
      <button class="danger-btn delete-btn" data-id="${device.id}">Delete</button>
    </div>
  `;
  
  // Add event listeners
  const connectBtn = card.querySelector('.connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', () => connectDevice(device.id));
  }
  
  const disconnectBtn = card.querySelector('.disconnect-btn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => disconnectDevice(device.id));
  }
  
  const editBtn = card.querySelector('.edit-btn');
  editBtn.addEventListener('click', () => openEditDeviceModal(device));
  
  const deleteBtn = card.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => deleteDevice(device.id));
  
  return card;
}

async function fetchConnections() {
  try {
    connectionList.innerHTML = '<div class="loading">Loading connections...</div>';
    
    const response = await fetch(API.connections);
    const connections = await response.json();
    
    if (connections.length === 0) {
      connectionList.innerHTML = '<div class="card"><p>No active connections.</p></div>';
      return;
    }
    
    connectionList.innerHTML = '';
    connections.forEach(conn => {
      const card = document.createElement('div');
      card.className = 'card';
      
      card.innerHTML = `
        <div class="card-header">
          <h3 class="card-title">${conn.deviceName}</h3>
          <span class="status-badge status-online">Connected</span>
        </div>
        <div class="card-body">
          <p><strong>Device ID:</strong> ${conn.deviceId}</p>
          <p><strong>Protocol:</strong> ${conn.protocol}</p>
          <p><strong>Connected Since:</strong> ${new Date(conn.connectedAt).toLocaleString()}</p>
        </div>
        <div class="card-actions">
          <button class="secondary-btn disconnect-btn" data-id="${conn.deviceId}">Disconnect</button>
        </div>
      `;
      
      const disconnectBtn = card.querySelector('.disconnect-btn');
      disconnectBtn.addEventListener('click', () => disconnectDevice(conn.deviceId));
      
      connectionList.appendChild(card);
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    connectionList.innerHTML = '<div class="card"><p>Error loading connections. Please try again.</p></div>';
  }
}

function updateDeviceOptions(devices) {
  targetDevices.innerHTML = '';
  
  devices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.id;
    option.textContent = device.name;
    // Disable options for devices that aren't connected
    if (device.status !== 'ONLINE') {
      option.disabled = true;
      option.textContent += ' (Offline)';
    }
    targetDevices.appendChild(option);
  });
}

async function connectDevice(id) {
  try {
    const response = await fetch(`${API.devices}/${id}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to connect to device');
    }
    
    // Refresh device lists
    fetchDevices();
    fetchConnections();
  } catch (error) {
    console.error('Error connecting to device:', error);
    alert(`Error connecting to device: ${error.message}`);
  }
}

async function disconnectDevice(id) {
  try {
    const response = await fetch(`${API.devices}/${id}/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to disconnect from device');
    }
    
    // Refresh device lists
    fetchDevices();
    fetchConnections();
  } catch (error) {
    console.error('Error disconnecting from device:', error);
    alert(`Error disconnecting from device: ${error.message}`);
  }
}

async function deleteDevice(id) {
  if (!confirm('Are you sure you want to delete this device?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API.devices}/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete device');
    }
    
    // Refresh device list
    fetchDevices();
  } catch (error) {
    console.error('Error deleting device:', error);
    alert(`Error deleting device: ${error.message}`);
  }
}

function setupDeviceModal() {
  // Open modal when add button is clicked
  addDeviceBtn.addEventListener('click', openAddDeviceModal);
  
  // Close modal when X or Cancel is clicked
  closeBtn.addEventListener('click', closeDeviceModal);
  cancelBtn.addEventListener('click', closeDeviceModal);
  
  // Close modal when clicking outside the modal
  window.addEventListener('click', (e) => {
    if (e.target === deviceModal) {
      closeDeviceModal();
    }
  });
  
  // Form submission
  deviceForm.addEventListener('submit', handleDeviceFormSubmit);
}

function openAddDeviceModal() {
  document.getElementById('modal-title').textContent = 'Add New Device';
  document.getElementById('device-id').value = '';
  deviceForm.reset();
  deviceModal.style.display = 'block';
}

function openEditDeviceModal(device) {
  document.getElementById('modal-title').textContent = 'Edit Device';
  document.getElementById('device-id').value = device.id;
  document.getElementById('device-name').value = device.name;
  document.getElementById('device-type').value = device.type;
  document.getElementById('device-ip').value = device.ipAddress;
  document.getElementById('device-port').value = device.port;
  document.getElementById('device-protocol').value = device.protocol;
  
  if (device.settings) {
    document.getElementById('char-rate').value = device.settings.characterRateLimit || 30;
    document.getElementById('backspace-processing').checked = 
      device.settings.backspaceProcessing !== undefined ? device.settings.backspaceProcessing : true;
  }
  
  deviceModal.style.display = 'block';
}

function closeDeviceModal() {
  deviceModal.style.display = 'none';
  deviceForm.reset();
}

async function handleDeviceFormSubmit(e) {
  e.preventDefault();
  
  const deviceId = document.getElementById('device-id').value;
  const isEdit = !!deviceId;
  
  const deviceData = {
    name: document.getElementById('device-name').value,
    type: document.getElementById('device-type').value,
    ipAddress: document.getElementById('device-ip').value,
    port: parseInt(document.getElementById('device-port').value),
    protocol: document.getElementById('device-protocol').value,
    settings: {
      characterRateLimit: parseInt(document.getElementById('char-rate').value),
      backspaceProcessing: document.getElementById('backspace-processing').checked
    }
  };
  
  try {
    let response;
    
    if (isEdit) {
      // Update existing device
      response = await fetch(`${API.devices}/${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deviceData)
      });
    } else {
      // Create new device
      response = await fetch(API.devices, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deviceData)
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save device');
    }
    
    // Close modal and refresh device list
    closeDeviceModal();
    fetchDevices();
  } catch (error) {
    console.error('Error saving device:', error);
    alert(`Error saving device: ${error.message}`);
  }
}

// LLM Streaming
function setupLLMControls() {
  sendPromptBtn.addEventListener('click', sendPromptToDevices);
}

async function fetchLLMProviders() {
  try {
    const response = await fetch(API.llmProviders);
    const providers = await response.json();
    
    // Update the provider dropdown based on available providers
    llmProvider.innerHTML = '';
    
    providers.forEach(provider => {
      const option = document.createElement('option');
      option.value = provider.provider;
      option.textContent = `${provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}`;
      
      if (!provider.available) {
        option.disabled = true;
        option.textContent += ' (Not Available)';
      }
      
      llmProvider.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching LLM providers:', error);
  }
}

async function sendPromptToDevices() {
  const selectedDevices = Array.from(targetDevices.selectedOptions).map(option => option.value);
  const provider = llmProvider.value;
  const prompt = promptInput.value.trim();
  
  if (selectedDevices.length === 0) {
    alert('Please select at least one device');
    return;
  }
  
  if (!prompt) {
    alert('Please enter a prompt');
    return;
  }
  
  try {
    llmStatusDisplay.innerHTML = 'Sending request...';
    
    let response;
    
    if (selectedDevices.length === 1) {
      // Stream to a single device
      response = await fetch(`${API.streamToDevice}/${selectedDevices[0]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, provider })
      });
    } else {
      // Stream to multiple devices
      response = await fetch(API.streamToMultiple, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deviceIds: selectedDevices, prompt, provider })
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send prompt to devices');
    }
    
    const result = await response.json();
    
    // Update status display
    llmStatusDisplay.innerHTML = `
      <div>
        <p><strong>Status:</strong> Streaming</p>
        <p><strong>Provider:</strong> ${provider}</p>
        <p><strong>Prompt:</strong> ${prompt}</p>
        <p><strong>Devices:</strong> ${selectedDevices.length}</p>
        <p><strong>Started at:</strong> ${new Date().toLocaleString()}</p>
      </div>
    `;
    
    // Clear prompt input
    promptInput.value = '';
  } catch (error) {
    console.error('Error sending prompt to devices:', error);
    llmStatusDisplay.innerHTML = `Error: ${error.message}`;
  }
}

// Refresh data periodically
setInterval(fetchDevices, 10000);
setInterval(fetchConnections, 5000);