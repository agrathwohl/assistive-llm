# Assistive LLM

A comprehensive assistive device interface for LLM streaming using the T.140 real-time text protocol. This application helps users with disabilities, particularly those who are deaf or hard-of-hearing, by providing real-time text communication from large language models (LLMs) to their assistive devices.

## Features

### Core Features
- **Multiple Transport Protocols**: WebSocket, RTP, SRTP, Unix sockets (STREAM and SEQPACKET)
- **LLM Provider Support**: OpenAI GPT models and Anthropic Claude models
- **Advanced T.140 Features**:
  - Forward Error Correction (FEC)
  - Redundancy (RED) for reliability
  - Configurable character rate limiting
  - Backspace processing
- **Device Management**: Easy-to-use web interface for managing assistive devices
- **Conversation History**: Persistent conversation tracking and management
- **Real-time Streaming**: Native t140llm integration for optimal performance
- **Security**: SRTP support for encrypted communications

### Supported Device Types
- Hearing devices (for deaf or hard-of-hearing users)
- Visual devices (for blind or low vision users)
- Mobility devices (for users with mobility impairments)
- Cognitive devices (for users with cognitive disabilities)
- Multi-purpose devices

## Screenshots

![Device Management](assets/devices-1.png)
![LLM Chat Interface](assets/llm-chat-1.png)
![Settings](assets/settings-1.png)

## Prerequisites

- [Node.js](https://nodejs.org/) >= 10.18.1
- [npm](https://www.npmjs.com/) >= 6.13.4
- OpenAI and/or Anthropic API keys (at least one is required)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/assistive-llm.git
cd assistive-llm
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file from the example:

```bash
cp .env.example .env
```

4. Edit `.env` and add your API keys:

```env
# At least one LLM provider API key is required
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

5. Build the application:

```bash
npm run build
```

## Usage

### Start the Server

For production:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

The server will start at `http://localhost:3000` (or your configured PORT).

### Access the Admin Interface

Open your browser and navigate to `http://localhost:3000`. The admin interface provides:

1. **Devices Page**: Manage assistive devices, connect/disconnect, view active connections
2. **LLM Chat Page**: Send prompts to connected devices, select provider
3. **Settings Page**: Configure API keys and default settings

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server configuration
PORT=3000
HOST=localhost

# LLM configuration
DEFAULT_LLM_PROVIDER=anthropic
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Logging configuration
LOG_LEVEL=info
LOG_FILE=assistive-llm.log

# Database configuration
DB_PATH=./data
```

### Device Configuration

When adding a device, you can configure:

#### Basic Settings
- **Name**: Friendly name for the device
- **Type**: Device category (hearing, visual, mobility, cognitive, multi-purpose)
- **IP Address**: Device IP address or hostname
- **Port**: Device port number
- **Protocol**: Transport protocol (websocket, rtp, srtp, unix-stream, unix-seqpacket)

#### Advanced Settings
- **Character Rate Limit**: Maximum characters per second (1-100)
- **Backspace Processing**: Whether to process backspace characters
- **Enable FEC**: Forward Error Correction for unreliable networks
- **Enable RED**: Redundancy for improved reliability
- **Redundancy Generations**: Number of redundant generations (1-3)

#### SRTP Configuration (for SRTP protocol)
- **SRTP Passphrase**: Simple passphrase (keys auto-generated)
- OR **SRTP Key/Salt**: Base64-encoded master key and salt

#### Unix Socket Configuration (for unix-stream/unix-seqpacket)
- **Socket Path**: Path to Unix socket file (e.g., `/tmp/device.sock`)

## API Endpoints

### Device Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | Get all registered devices |
| GET | `/api/devices/:id` | Get a specific device |
| POST | `/api/devices` | Add a new device |
| PUT | `/api/devices/:id` | Update a device |
| DELETE | `/api/devices/:id` | Delete a device |
| POST | `/api/devices/:id/connect` | Connect to a device |
| POST | `/api/devices/:id/disconnect` | Disconnect from a device |
| GET | `/api/devices/connections/active` | Get all active connections |

### LLM Streaming

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/llm/providers` | Get available LLM providers |
| POST | `/api/llm/stream/:deviceId` | Stream LLM response to a device |
| POST | `/api/llm/stream-multiple` | Stream LLM response to multiple devices |
| GET | `/api/llm/conversations/:conversationId` | Get conversation history |
| GET | `/api/llm/devices/:deviceId/conversations` | Get device conversations |
| DELETE | `/api/llm/conversations/:conversationId` | Clear conversation history |

### API Examples

#### Stream to a Device

```bash
curl -X POST http://localhost:3000/api/llm/stream/device-id \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Tell me a short story",
    "provider": "anthropic"
  }'
```

#### Stream to Multiple Devices

```bash
curl -X POST http://localhost:3000/api/llm/stream-multiple \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIds": ["device-1", "device-2"],
    "prompt": "What is the weather like?",
    "provider": "openai"
  }'
```

#### Get Conversation History

```bash
curl http://localhost:3000/api/llm/conversations/conversation-id
```

## Architecture

The application follows a layered architecture:

### Services Layer
- **DeviceService**: Manages device registration, connection, and transport creation
- **LLMService**: Handles LLM provider integration and streaming
- **ConversationService**: Manages conversation history and metadata

### Transport Layer
Powered by [t140llm](https://github.com/agrathwohl/t140llm), supporting:
- WebSocket connections
- RTP/SRTP direct streaming
- Unix socket communication
- Advanced T.140 features (FEC, RED, redundancy)

### Data Persistence
- File-based storage for device configurations
- JSON-based conversation history
- Configurable data directory

## Development

### Project Structure

```
assistive-llm/
├── src/
│   ├── config/          # Configuration management
│   ├── controllers/     # API controllers
│   ├── interfaces/      # TypeScript interfaces
│   ├── middleware/      # Express middleware
│   ├── public/          # Static web files
│   │   ├── css/        # Stylesheets
│   │   └── js/         # Client-side JavaScript
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
├── dist/                # Compiled JavaScript (generated)
├── data/                # Data storage (generated)
└── package.json
```

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

## Troubleshooting

### Common Issues

1. **"At least one LLM provider API key must be configured"**
   - Ensure you've set either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in your `.env` file

2. **Device connection fails**
   - Verify the device IP address and port are correct
   - Check that the device is reachable from the server
   - Ensure the correct protocol is selected
   - For SRTP, verify keys/passphrase are valid

3. **Streaming doesn't work**
   - Confirm the device is connected (check Devices page)
   - Verify the selected LLM provider is available
   - Check server logs for detailed error messages

4. **Build fails**
   - Ensure all dependencies are installed: `npm install`
   - Check Node.js version is >= 10.18.1

## Advanced Features

### Forward Error Correction (FEC)

Enable FEC in device settings to add error correction for unreliable network connections. This duplicates T.140 data with parity information to recover from packet loss.

### Redundancy (RED)

Enable RED to send multiple generations of each text segment, improving reliability on lossy networks. Configure 1-3 generations based on your network quality.

### SRTP Encryption

For secure communications, use the SRTP protocol. You can either:
- Provide a simple passphrase (keys auto-generated)
- Provide base64-encoded master key and salt

### Character Rate Limiting

Adjust the character rate limit (characters per second) to match your device's display capabilities. Default is 30 cps, suitable for most real-time text displays.

### Conversation History

The system automatically tracks all conversations. Use the conversation ID returned from streaming requests to:
- Continue existing conversations
- Review message history
- Clear old conversations

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [t140llm](https://github.com/agrathwohl/t140llm) by agrathwohl
- Supports OpenAI and Anthropic LLM providers
- Designed for accessibility and real-time communication

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing documentation
- Review the t140llm library documentation

## Changelog

### Version 1.0.0
- Initial release with comprehensive t140llm integration
- Support for WebSocket, RTP, SRTP, and Unix socket transports
- OpenAI and Anthropic provider support
- Conversation history and management
- Advanced T.140 features (FEC, RED, redundancy)
- Web-based admin interface
- Device management and connection handling
