# Assistive LLM

An assistive device interface for LLM streaming using the T.140 real-time text protocol. This application helps disabled users, particularly those who are deaf or hard-of-hearing, by providing real-time text communication from large language models (LLMs) to their assistive devices.

## Features

- Connect to assistive devices via WebSocket or RTP transport using the T.140 protocol
- Stream responses from OpenAI and Anthropic LLMs to assistive devices
- Web-based admin interface for device management
- Support for different device types (hearing, visual, mobility, cognitive)
- Customizable character rate limiting for assistive devices
- File-based persistence for device configuration

## Prerequisites

- Node.js (v14 or higher)
- npm or pnpm
- OpenAI and/or Anthropic API keys (optional, but required for LLM streaming)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/assistive-llm.git
cd assistive-llm
```

2. Install dependencies:

```bash
npm install
# or
pnpm install
```

3. Build the application:

```bash
npm run build
# or
pnpm build
```

## Configuration

Create a `.env` file in the root directory with the following environment variables:

```env
# Server configuration
PORT=3000
HOST=localhost

# LLM configuration
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Logging configuration
LOG_LEVEL=info
LOG_FILE=assistive-llm.log

# Database configuration
DB_PATH=./data
```

## Usage

1. Start the server:

```bash
npm start
# or
pnpm start
```

2. For development with auto-restart:

```bash
npm run dev
# or
pnpm dev
```

3. Access the admin interface at `http://localhost:3000`

## API Endpoints

### Device Management

- `GET /api/devices` - Get all devices
- `GET /api/devices/:id` - Get a specific device
- `POST /api/devices` - Add a new device
- `PUT /api/devices/:id` - Update a device
- `DELETE /api/devices/:id` - Delete a device
- `POST /api/devices/:id/connect` - Connect to a device
- `POST /api/devices/:id/disconnect` - Disconnect from a device
- `GET /api/devices/connections/active` - Get all active connections

### LLM Streaming

- `GET /api/llm/providers` - Get available LLM providers
- `POST /api/llm/stream/:deviceId` - Stream LLM response to a device
- `POST /api/llm/stream-multiple` - Stream LLM response to multiple devices

## Architecture

- The application follows a layered architecture with controllers, services, and routes
- Device configurations are persisted to disk using a simple file-based storage system
- Real-time streaming is handled by the t140llm library
- The web admin interface uses vanilla JavaScript and makes API calls to the backend

## License

MIT