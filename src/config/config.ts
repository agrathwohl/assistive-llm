/**
 * Application configuration
 */
export const config = {
  // Server configuration
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    host: process.env.HOST || 'localhost'
  },

  // T140 configuration
  t140: {
    websocketPort: 8765,         // Default WebSocket port for t140llm
    rtpPort: 5004,               // Default RTP port for t140llm
    charRateLimit: 30,           // Default character rate limit (30 chars/sec)
    defaultBackspaceProcessing: true,  // Process backspace characters by default

    // Advanced features
    enableFEC: false,            // Enable Forward Error Correction by default
    enableRED: false,            // Enable Redundancy by default
    redundancyGenerations: 2,    // Number of redundancy generations (1-3)

    // Token pooling for rate limiting
    tokenPoolSize: 100,          // Maximum tokens in pool
    tokenRefillRate: 30,         // Tokens per second
  },

  // LLM configuration
  llm: {
    defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    },

    // Conversation settings
    maxHistoryLength: 50,        // Maximum number of messages to keep in history
    saveConversations: true,     // Save conversation history to disk
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'assistive-llm.log'
  },

  // Database configuration (using file system for simplicity)
  database: {
    path: process.env.DB_PATH || './data'
  },

  // WebSocket configuration for real-time updates
  websocket: {
    enabled: true,
    heartbeatInterval: 30000,    // 30 seconds
  }
};

/**
 * Validate configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.llm.openai.apiKey && !config.llm.anthropic.apiKey) {
    errors.push('At least one LLM provider API key must be configured');
  }

  if (config.t140.charRateLimit < 1 || config.t140.charRateLimit > 100) {
    errors.push('Character rate limit must be between 1 and 100');
  }

  if (config.t140.redundancyGenerations < 1 || config.t140.redundancyGenerations > 3) {
    errors.push('Redundancy generations must be between 1 and 3');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
