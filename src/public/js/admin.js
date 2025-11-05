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

// Notification Elements
const notificationBell = document.getElementById('notification-bell');
const notificationBadge = document.getElementById('notification-badge');
const notificationPanel = document.getElementById('notification-panel');
const notificationList = document.getElementById('notification-list');
const closePanelBtn = document.getElementById('close-panel-btn');
const markAllReadBtn = document.getElementById('mark-all-read-btn');
const clearAllNotificationsBtn = document.getElementById('clear-all-notifications-btn');
const notificationLevelFilter = document.getElementById('notification-level-filter');
const notificationCategoryFilter = document.getElementById('notification-category-filter');
const toastContainer = document.getElementById('toast-container');

// API endpoints
const API = {
  devices: '/api/devices',
  connections: '/api/devices/connections/active',
  llmProviders: '/api/llm/providers',
  streamToDevice: '/api/llm/stream',
  streamToMultiple: '/api/llm/stream-multiple',
  notifications: '/api/notifications',
  notificationsUnreadCount: '/api/notifications/unread/count',
  notificationsMarkAllRead: '/api/notifications/read-all'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Load initial data
  fetchDevices();
  fetchConnections();
  fetchLLMProviders();
  fetchNotifications();
  updateUnreadCount();

  // Set up event listeners
  setupNavigation();
  setupDeviceModal();
  setupLLMControls();
  setupNotifications();
  setupWebSocket();
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
setInterval(fetchNotifications, 30000);
setInterval(updateUnreadCount, 15000);

// ========================================
// Notification System
// ========================================

function setupNotifications() {
  // Toggle notification panel
  notificationBell.addEventListener('click', () => {
    notificationPanel.classList.toggle('open');
  });

  // Close notification panel
  closePanelBtn.addEventListener('click', () => {
    notificationPanel.classList.remove('open');
  });

  // Mark all as read
  markAllReadBtn.addEventListener('click', async () => {
    try {
      await fetch(API.notificationsMarkAllRead, { method: 'PUT' });
      await fetchNotifications();
      await updateUnreadCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  });

  // Clear all notifications
  clearAllNotificationsBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all notifications?')) {
      return;
    }
    try {
      await fetch(API.notifications, { method: 'DELETE' });
      await fetchNotifications();
      await updateUnreadCount();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  });

  // Filter notifications
  notificationLevelFilter.addEventListener('change', fetchNotifications);
  notificationCategoryFilter.addEventListener('change', fetchNotifications);

  // Request browser notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function fetchNotifications() {
  try {
    const level = notificationLevelFilter.value;
    const category = notificationCategoryFilter.value;

    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (category) params.append('category', category);

    const url = `${API.notifications}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch notifications');
    }

    renderNotifications(data.notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    notificationList.innerHTML = '<div class="loading">Error loading notifications</div>';
  }
}

function renderNotifications(notifications) {
  if (notifications.length === 0) {
    notificationList.innerHTML = '<div class="loading">No notifications</div>';
    return;
  }

  notificationList.innerHTML = '';

  notifications.forEach(notification => {
    const item = createNotificationItem(notification);
    notificationList.appendChild(item);
  });
}

function createNotificationItem(notification) {
  const item = document.createElement('div');
  item.className = `notification-item ${!notification.read ? 'unread' : ''}`;
  item.dataset.id = notification.id;

  const timeAgo = formatTimeAgo(new Date(notification.timestamp));

  item.innerHTML = `
    <div class="notification-item-header">
      <h4 class="notification-title">${escapeHtml(notification.title)}</h4>
      <span class="notification-time">${timeAgo}</span>
    </div>
    <p class="notification-message">${escapeHtml(notification.message)}</p>
    <div class="notification-meta">
      <span class="notification-level ${notification.level}">${notification.level}</span>
      <span class="notification-category">${notification.category}</span>
    </div>
  `;

  // Mark as read when clicked
  item.addEventListener('click', async () => {
    if (!notification.read) {
      try {
        await fetch(`${API.notifications}/${notification.id}/read`, { method: 'PUT' });
        item.classList.remove('unread');
        await updateUnreadCount();
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
  });

  return item;
}

async function updateUnreadCount() {
  try {
    const response = await fetch(API.notificationsUnreadCount);
    const data = await response.json();

    if (data.success) {
      if (data.count > 0) {
        notificationBadge.textContent = data.count > 99 ? '99+' : data.count;
        notificationBadge.style.display = 'block';
      } else {
        notificationBadge.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error updating unread count:', error);
  }
}

function showToast(notification) {
  const toast = document.createElement('div');
  toast.className = `toast ${notification.level}`;

  const icon = getNotificationIcon(notification.level);

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(notification.title)}</div>
      <div class="toast-message">${escapeHtml(notification.message)}</div>
    </div>
    <button class="toast-close">×</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.remove();
  });

  toastContainer.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);

  // Show browser notification for critical/error levels
  if ((notification.level === 'critical' || notification.level === 'error') &&
      'Notification' in window && Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      tag: notification.id
    });
  }
}

function getNotificationIcon(level) {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    critical: '🚨'
  };
  return icons[level] || 'ℹ️';
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// WebSocket for real-time updates
function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws/admin`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'notification') {
        // Show toast notification
        showToast(message.data);

        // Update notification list and unread count
        fetchNotifications();
        updateUnreadCount();
      } else if (message.type === 'initial_data') {
        // Handle initial data if needed
        if (message.data.unreadCount) {
          if (message.data.unreadCount > 0) {
            notificationBadge.textContent = message.data.unreadCount > 99 ? '99+' : message.data.unreadCount;
            notificationBadge.style.display = 'block';
          }
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected, attempting to reconnect...');
    setTimeout(setupWebSocket, 5000);
  };
}