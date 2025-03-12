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
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    }
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'assistive-llm.log'
  },
  
  // Database configuration (using file system for simplicity)
  database: {
    path: process.env.DB_PATH || './data'
  }
};