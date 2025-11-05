# Web Conferencing Integration Guide

## Overview

This document outlines the architecture and implementation plan for integrating Assistive-LLM with popular web conferencing platforms to provide real-time captioning and accessibility features.

## Supported Platforms

### Tier 1: Priority Integrations
- **Zoom** - Market leader, extensive API
- **Google Meet** - Growing adoption, WebRTC-based
- **Microsoft Teams** - Enterprise standard
- **WebRTC Generic** - Universal browser-based solution

### Tier 2: Additional Platforms
- **Cisco Webex**
- **Discord** - Gaming/community focus
- **Jitsi Meet** - Open source alternative
- **Amazon Chime**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Assistive-LLM Server                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │          WebRTC Conference Bridge                 │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  Audio Stream → Speech-to-Text → T.140 Device    │  │
│  │  Video Stream → Visual Description → Device      │  │
│  │  LLM Enhancement → Context-Aware Captions        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓ ↑
              ┌──────────────────────┐
              │  Conferencing APIs   │
              ├──────────────────────┤
              │  • Zoom SDK          │
              │  • Meet API          │
              │  • Teams Graph API   │
              │  • WebRTC Signaling  │
              └──────────────────────┘
                         ↓ ↑
              ┌──────────────────────┐
              │  Conference Session  │
              │  (Audio/Video)       │
              └──────────────────────┘
```

---

## Feature Set

### Phase 1: Audio Captioning
- Real-time speech-to-text during calls
- Stream captions to T.140 devices
- Multi-speaker identification
- LLM-enhanced caption formatting

### Phase 2: Visual Assistance
- Screen share descriptions
- Participant video descriptions
- Gesture/expression interpretation
- Meeting context awareness

### Phase 3: Interactive Features
- Voice commands to LLM
- Meeting summarization
- Action item extraction
- Q&A assistance for hearing-impaired

---

## Implementation Guide

### 1. Zoom Integration

#### Prerequisites
```bash
npm install @zoom/videosdk @zoom/meetingsdk
```

#### Architecture

```typescript
// src/integrations/zoom/zoom-bridge.ts
import { ZoomVideo } from '@zoom/videosdk';

export class ZoomConferenceBridge {
  private client: typeof ZoomVideo;
  private audioStream: MediaStream | null = null;
  private transcriptionService: TranscriptionService;

  constructor(
    private deviceService: DeviceService,
    private llmService: LLMService
  ) {
    this.transcriptionService = new TranscriptionService();
    this.initializeZoomSDK();
  }

  async initializeZoomSDK() {
    this.client = ZoomVideo.createClient();

    await this.client.init('en-US', 'Global', {
      patchJsMedia: true,
      leaveOnPageUnload: false
    });
  }

  async joinMeeting(meetingConfig: ZoomMeetingConfig) {
    const { meetingNumber, password, userName, userEmail, signature } = meetingConfig;

    await this.client.join(
      meetingNumber,
      signature,
      userName,
      password
    );

    // Start capturing audio
    await this.startAudioCapture();

    // Setup event listeners
    this.setupEventHandlers();
  }

  private async startAudioCapture() {
    const mediaStream = this.client.getMediaStream();

    // Start receiving audio
    await mediaStream.startAudio();

    // Get audio stream
    this.audioStream = await mediaStream.getAudioTrack();

    // Process audio for transcription
    this.processAudioStream(this.audioStream);
  }

  private processAudioStream(stream: MediaStream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = async (event) => {
      const audioData = event.inputBuffer.getChannelData(0);

      // Send to transcription service
      const transcript = await this.transcriptionService.transcribe(audioData);

      if (transcript) {
        // Enhance with LLM (optional)
        const enhanced = await this.enhanceTranscript(transcript);

        // Stream to all connected devices
        await this.streamToDevices(enhanced);
      }
    };
  }

  private async enhanceTranscript(transcript: string): Promise<string> {
    // Optional: Use LLM to improve transcript quality
    // - Fix grammar
    // - Add punctuation
    // - Format for readability

    if (this.llmService && transcript.length > 100) {
      const prompt = `Improve this transcript for clarity:\n"${transcript}"`;
      // Use streaming LLM for real-time enhancement
      return enhanced;
    }

    return transcript;
  }

  private async streamToDevices(text: string) {
    const connections = this.deviceService.getActiveConnections();

    for (const connection of connections) {
      if (connection.transport.sendText) {
        connection.transport.sendText(text);
      }
    }
  }

  private setupEventHandlers() {
    const mediaStream = this.client.getMediaStream();

    // Handle participant audio changes
    mediaStream.on('user-audio-active', (payload) => {
      console.log(`User ${payload.userId} started speaking`);
    });

    // Handle screen share
    mediaStream.on('share-video-enabled', async (payload) => {
      // Get screen share stream
      const shareStream = await mediaStream.getShareStream();
      // Optionally describe screen content for blind users
      await this.describeScreenShare(shareStream);
    });

    // Handle meeting end
    this.client.on('connection-change', (payload) => {
      if (payload.state === 'Closed') {
        this.cleanup();
      }
    });
  }

  private async describeScreenShare(stream: MediaStream) {
    // Capture frames and describe using vision model
    // Implementation depends on vision API (GPT-4V, Claude 3, etc.)
  }

  async leaveMeeting() {
    await this.client.leave();
    this.cleanup();
  }

  private cleanup() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
    }
    this.audioStream = null;
  }
}
```

#### Zoom Meeting Configuration

```typescript
// src/integrations/zoom/zoom-config.ts
export interface ZoomMeetingConfig {
  meetingNumber: string;
  password?: string;
  userName: string;
  userEmail: string;
  signature: string; // Generated server-side
}

export class ZoomConfigService {
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey = process.env.ZOOM_API_KEY!;
    this.apiSecret = process.env.ZOOM_API_SECRET!;
  }

  generateSignature(meetingNumber: string, role: number): string {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2; // 2 hours

    const payload = {
      sdkKey: this.apiKey,
      mn: meetingNumber,
      role: role,
      iat: iat,
      exp: exp,
      appKey: this.apiKey,
      tokenExp: exp
    };

    // Use HMAC-SHA256 to generate signature
    return jwt.sign(payload, this.apiSecret);
  }
}
```

#### API Endpoint

```typescript
// src/controllers/conference.controller.ts
import { Request, Response } from 'express';
import { ZoomConferenceBridge } from '../integrations/zoom/zoom-bridge';

export class ConferenceController {
  private activeBridges: Map<string, ZoomConferenceBridge> = new Map();

  async joinZoomMeeting(req: Request, res: Response) {
    const { meetingNumber, password, deviceIds } = req.body;

    try {
      // Generate signature
      const configService = new ZoomConfigService();
      const signature = configService.generateSignature(meetingNumber, 0);

      // Create bridge
      const bridge = new ZoomConferenceBridge(
        this.deviceService,
        this.llmService
      );

      // Join meeting
      await bridge.joinMeeting({
        meetingNumber,
        password,
        userName: 'Assistive-LLM Bot',
        userEmail: 'bot@assistive-llm.com',
        signature
      });

      // Store bridge reference
      const sessionId = uuidv4();
      this.activeBridges.set(sessionId, bridge);

      res.json({
        success: true,
        sessionId,
        message: 'Joined Zoom meeting successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to join Zoom meeting',
        details: error.message
      });
    }
  }

  async leaveMeeting(req: Request, res: Response) {
    const { sessionId } = req.params;

    const bridge = this.activeBridges.get(sessionId);
    if (!bridge) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await bridge.leaveMeeting();
    this.activeBridges.delete(sessionId);

    res.json({ success: true, message: 'Left meeting successfully' });
  }
}
```

---

### 2. Google Meet Integration

#### Architecture

Google Meet doesn't provide official SDK for bots, so we use two approaches:

**Approach A: Browser Automation (Puppeteer)**

```typescript
// src/integrations/google-meet/meet-bridge.ts
import puppeteer from 'puppeteer';

export class GoogleMeetBridge {
  private browser: puppeteer.Browser | null = null;
  private page: puppeteer.Page | null = null;

  async joinMeeting(meetingUrl: string) {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    this.page = await this.browser.newPage();

    // Grant microphone permissions
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions(meetingUrl, ['microphone', 'camera']);

    await this.page.goto(meetingUrl);

    // Wait for and click join button
    await this.page.waitForSelector('[data-tooltip="Join now"]');
    await this.page.click('[data-tooltip="Join now"]');

    // Start capturing audio
    await this.captureAudio();
  }

  private async captureAudio() {
    // Inject audio capture script
    await this.page!.evaluate(() => {
      const audioContext = new AudioContext();

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const source = audioContext.createMediaStreamSource(stream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);

          source.connect(processor);
          processor.connect(audioContext.destination);

          processor.onaudioprocess = (event) => {
            const audioData = event.inputBuffer.getChannelData(0);
            // Send audio data to server via WebSocket
            window.ws.send(JSON.stringify({
              type: 'audio',
              data: Array.from(audioData)
            }));
          };
        });
    });

    // Setup WebSocket connection from page to server
    await this.setupWebSocketBridge();
  }

  private async setupWebSocketBridge() {
    await this.page!.exposeFunction('sendAudioToServer', async (audioData: number[]) => {
      // Process audio data
      const transcript = await this.transcriptionService.transcribe(
        Float32Array.from(audioData)
      );

      if (transcript) {
        await this.streamToDevices(transcript);
      }
    });
  }

  async leaveMeeting() {
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}
```

**Approach B: Chrome Extension**

```javascript
// chrome-extension/content-script.js
// Inject into Google Meet page

(function() {
  let audioContext;
  let mediaStream;

  // Capture meeting audio
  async function captureAudio() {
    try {
      // Get display media with audio
      mediaStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        },
        video: true
      });

      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);

        // Send to background script
        chrome.runtime.sendMessage({
          type: 'audio-data',
          data: Array.from(audioData)
        });
      };

    } catch (error) {
      console.error('Failed to capture audio:', error);
    }
  }

  // Listen for start capture message
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'start-capture') {
      captureAudio();
      sendResponse({ success: true });
    } else if (message.type === 'stop-capture') {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
      sendResponse({ success: true });
    }
  });
})();
```

```javascript
// chrome-extension/background.js
// Send audio to Assistive-LLM server

let websocket;

chrome.runtime.onInstalled.addListener(() => {
  // Connect to Assistive-LLM WebSocket
  websocket = new WebSocket('ws://localhost:3000/ws/conference');

  websocket.onopen = () => {
    console.log('Connected to Assistive-LLM');
  };

  websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'transcript') {
      // Display caption overlay on Google Meet
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'show-caption',
          text: data.text
        });
      });
    }
  };
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'audio-data' && websocket) {
    // Forward audio to server
    websocket.send(JSON.stringify({
      type: 'audio',
      data: message.data
    }));
  }
});
```

---

### 3. Microsoft Teams Integration

#### Using Microsoft Graph API

```typescript
// src/integrations/teams/teams-bridge.ts
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';

export class TeamsBridge {
  private graphClient: Client;

  constructor() {
    const credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );

    const authProvider = new TokenCredentialAuthenticationProvider(
      credential,
      { scopes: ['https://graph.microsoft.com/.default'] }
    );

    this.graphClient = Client.initWithMiddleware({ authProvider });
  }

  async joinMeeting(meetingId: string, userId: string) {
    // Subscribe to call transcription
    const subscription = await this.graphClient
      .api(`/communications/calls/${meetingId}/transcripts`)
      .post({
        changeType: 'created,updated',
        notificationUrl: `${process.env.PUBLIC_URL}/webhooks/teams/transcript`,
        resource: `/communications/calls/${meetingId}/transcripts`,
        expirationDateTime: new Date(Date.now() + 3600000).toISOString(),
        clientState: 'secretClientValue'
      });

    return subscription;
  }

  async handleTranscriptWebhook(payload: any) {
    const { value } = payload;

    for (const change of value) {
      if (change.resourceData) {
        const transcript = change.resourceData;

        // Process transcript
        await this.processTranscript(transcript);
      }
    }
  }

  private async processTranscript(transcript: any) {
    const text = transcript.content;
    const speaker = transcript.speakerName;

    // Format with speaker identification
    const formatted = `${speaker}: ${text}`;

    // Stream to devices
    await this.streamToDevices(formatted);
  }
}
```

#### Webhook Handler

```typescript
// src/controllers/webhooks/teams-webhook.controller.ts
export class TeamsWebhookController {
  private teamsBridge: TeamsBridge;

  constructor() {
    this.teamsBridge = new TeamsBridge();
  }

  async handleTranscript(req: Request, res: Response) {
    const { validationToken } = req.query;

    // Handle subscription validation
    if (validationToken) {
      return res.send(validationToken);
    }

    // Process transcript update
    await this.teamsBridge.handleTranscriptWebhook(req.body);

    res.status(200).send();
  }
}
```

---

### 4. Generic WebRTC Bridge

For platforms without official APIs, create a universal WebRTC bridge:

```typescript
// src/integrations/webrtc/universal-bridge.ts
import { RTCPeerConnection, MediaStream } from 'wrtc';

export class UniversalWebRTCBridge {
  private peerConnection: RTCPeerConnection;
  private audioTracks: MediaStreamTrack[] = [];

  constructor() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    this.setupPeerConnection();
  }

  private setupPeerConnection() {
    this.peerConnection.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        this.audioTracks.push(event.track);
        this.processAudioTrack(event.track);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to signaling server
        this.sendIceCandidate(event.candidate);
      }
    };
  }

  async connectToRoom(signalingServer: string, roomId: string) {
    const ws = new WebSocket(signalingServer);

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'offer':
          await this.handleOffer(data.offer);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(data.candidate);
          break;
      }
    };

    ws.onopen = () => {
      // Join room
      ws.send(JSON.stringify({
        type: 'join',
        roomId
      }));
    };
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // Send answer back through signaling
    this.sendAnswer(answer);
  }

  private processAudioTrack(track: MediaStreamTrack) {
    // Similar audio processing as before
    const audioContext = new AudioContext();
    const stream = new MediaStream([track]);
    const source = audioContext.createMediaStreamSource(stream);

    // ... transcription logic
  }
}
```

---

## Transcription Service

### Speech-to-Text Options

```typescript
// src/services/transcription.service.ts
import { SpeechClient } from '@google-cloud/speech';
import WebSocket from 'ws';

export class TranscriptionService {
  private provider: 'google' | 'assemblyai' | 'deepgram';
  private client: any;

  constructor(provider: 'google' | 'assemblyai' | 'deepgram' = 'google') {
    this.provider = provider;
    this.initializeClient();
  }

  private initializeClient() {
    switch (this.provider) {
      case 'google':
        this.client = new SpeechClient({
          keyFilename: process.env.GOOGLE_CREDENTIALS_PATH
        });
        break;
      case 'assemblyai':
        this.client = new WebSocket(
          'wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000',
          {
            headers: {
              authorization: process.env.ASSEMBLYAI_API_KEY!
            }
          }
        );
        break;
      case 'deepgram':
        this.client = new WebSocket(
          `wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true`,
          {
            headers: {
              Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
            }
          }
        );
        break;
    }
  }

  async transcribe(audioData: Float32Array): Promise<string | null> {
    switch (this.provider) {
      case 'google':
        return this.transcribeGoogle(audioData);
      case 'assemblyai':
        return this.transcribeAssemblyAI(audioData);
      case 'deepgram':
        return this.transcribeDeepgram(audioData);
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  private async transcribeGoogle(audioData: Float32Array): Promise<string | null> {
    const audio = {
      content: Buffer.from(audioData.buffer).toString('base64')
    };

    const config = {
      encoding: 'LINEAR16' as const,
      sampleRateHertz: 16000,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true
    };

    const request = {
      audio: audio,
      config: config
    };

    try {
      const [response] = await this.client.recognize(request);
      const transcription = response.results
        ?.map((result: any) => result.alternatives[0].transcript)
        .join('\n');

      return transcription || null;
    } catch (error) {
      console.error('Transcription error:', error);
      return null;
    }
  }

  private async transcribeAssemblyAI(audioData: Float32Array): Promise<string | null> {
    return new Promise((resolve) => {
      // Convert Float32Array to base64
      const buffer = Buffer.from(audioData.buffer);
      const base64Audio = buffer.toString('base64');

      this.client.send(JSON.stringify({
        audio_data: base64Audio
      }));

      this.client.once('message', (data: string) => {
        const result = JSON.parse(data);
        resolve(result.text || null);
      });

      setTimeout(() => resolve(null), 5000);
    });
  }

  private async transcribeDeepgram(audioData: Float32Array): Promise<string | null> {
    return new Promise((resolve) => {
      this.client.send(audioData.buffer);

      this.client.once('message', (data: string) => {
        const result = JSON.parse(data);
        const transcript = result.channel?.alternatives[0]?.transcript;
        resolve(transcript || null);
      });

      setTimeout(() => resolve(null), 5000);
    });
  }
}
```

---

## UI Integration

### Conference Page

```html
<!-- src/public/conference.html -->
<section id="conference-page">
  <h2>Conference Integration</h2>

  <div class="conference-controls">
    <div class="form-group">
      <label>Platform:</label>
      <select id="conference-platform">
        <option value="zoom">Zoom</option>
        <option value="google-meet">Google Meet</option>
        <option value="teams">Microsoft Teams</option>
        <option value="webrtc">Generic WebRTC</option>
      </select>
    </div>

    <div class="form-group" id="zoom-config">
      <label>Meeting ID:</label>
      <input type="text" id="zoom-meeting-id">
      <label>Password:</label>
      <input type="password" id="zoom-password">
    </div>

    <div class="form-group" id="meet-config" style="display: none;">
      <label>Meeting URL:</label>
      <input type="text" id="meet-url" placeholder="https://meet.google.com/xxx-xxxx-xxx">
    </div>

    <div class="form-group">
      <label>Target Devices:</label>
      <select id="conference-devices" multiple></select>
    </div>

    <div class="form-group">
      <label>Transcription Provider:</label>
      <select id="transcription-provider">
        <option value="google">Google Cloud Speech</option>
        <option value="assemblyai">AssemblyAI</option>
        <option value="deepgram">Deepgram</option>
      </select>
    </div>

    <div class="conference-options">
      <label>
        <input type="checkbox" id="llm-enhancement">
        Enhance captions with LLM
      </label>
      <label>
        <input type="checkbox" id="speaker-identification">
        Identify speakers
      </label>
      <label>
        <input type="checkbox" id="meeting-notes">
        Generate meeting notes
      </label>
    </div>

    <button id="join-conference-btn" class="primary-btn">
      Join Conference
    </button>
    <button id="leave-conference-btn" class="secondary-btn" disabled>
      Leave Conference
    </button>
  </div>

  <div class="conference-status">
    <h3>Conference Status</h3>
    <div id="conference-status-display">
      Not connected
    </div>

    <div id="live-transcript">
      <h4>Live Transcript</h4>
      <div id="transcript-output"></div>
    </div>
  </div>
</section>
```

### JavaScript Client

```javascript
// src/public/js/conference.js
let activeSession = null;

document.getElementById('join-conference-btn').addEventListener('click', async () => {
  const platform = document.getElementById('conference-platform').value;
  const deviceIds = Array.from(
    document.getElementById('conference-devices').selectedOptions
  ).map(opt => opt.value);

  let config = { platform, deviceIds };

  if (platform === 'zoom') {
    config.meetingId = document.getElementById('zoom-meeting-id').value;
    config.password = document.getElementById('zoom-password').value;
  } else if (platform === 'google-meet') {
    config.meetingUrl = document.getElementById('meet-url').value;
  }

  try {
    const response = await fetch('/api/conference/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const result = await response.json();

    if (result.success) {
      activeSession = result.sessionId;
      document.getElementById('join-conference-btn').disabled = true;
      document.getElementById('leave-conference-btn').disabled = false;

      updateStatus('Connected to conference');
      connectToTranscriptStream(result.sessionId);
    }
  } catch (error) {
    alert('Failed to join conference: ' + error.message);
  }
});

function connectToTranscriptStream(sessionId) {
  const ws = new WebSocket(`ws://${window.location.host}/ws/conference/${sessionId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'transcript') {
      appendTranscript(data.text, data.speaker, data.timestamp);
    } else if (data.type === 'status') {
      updateStatus(data.message);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function appendTranscript(text, speaker, timestamp) {
  const output = document.getElementById('transcript-output');
  const entry = document.createElement('div');
  entry.className = 'transcript-entry';
  entry.innerHTML = `
    <span class="timestamp">${new Date(timestamp).toLocaleTimeString()}</span>
    <span class="speaker">${speaker || 'Unknown'}:</span>
    <span class="text">${text}</span>
  `;
  output.appendChild(entry);
  output.scrollTop = output.scrollHeight;
}
```

---

## Environment Configuration

```env
# Zoom
ZOOM_API_KEY=your_zoom_api_key
ZOOM_API_SECRET=your_zoom_api_secret

# Microsoft Teams
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret

# Transcription Services
GOOGLE_CREDENTIALS_PATH=/path/to/credentials.json
ASSEMBLYAI_API_KEY=your_assemblyai_key
DEEPGRAM_API_KEY=your_deepgram_key

# WebRTC
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=username
TURN_CREDENTIAL=password
```

---

## Security Considerations

1. **OAuth Flow**: Implement proper OAuth for user authentication
2. **Rate Limiting**: Limit API calls to conferencing platforms
3. **Data Privacy**: Don't store audio/video, only transcripts
4. **Encryption**: Use TLS for all communications
5. **Access Control**: Verify user has permission to join meetings

---

## Cost Estimates

### Transcription Costs (per hour of audio)
- **Google Cloud Speech**: ~$0.024/minute = $1.44/hour
- **AssemblyAI**: ~$0.00025/second = $0.90/hour
- **Deepgram**: ~$0.0125/minute = $0.75/hour

### Platform Costs
- **Zoom SDK**: Free for development, contact sales for production
- **Microsoft Graph API**: Included with Microsoft 365 E5 license
- **Google Meet**: No official API, relies on browser automation or extension

---

## Testing Strategy

1. **Unit Tests**: Test individual components
2. **Integration Tests**: Test with real conferencing APIs
3. **Load Tests**: Simulate multiple simultaneous conferences
4. **User Acceptance**: Test with actual assistive device users

---

## Roadmap

### Phase 1 (Month 1)
- ✅ Zoom integration with basic transcription
- ✅ Generic WebRTC bridge
- ✅ Simple UI for conference management

### Phase 2 (Month 2)
- Microsoft Teams integration
- Google Meet Chrome extension
- LLM-enhanced captions
- Speaker identification

### Phase 3 (Month 3)
- Visual description for screen shares
- Meeting summarization
- Action item extraction
- Multi-language support

---

## Next Steps

1. **Choose platforms** to prioritize
2. **Set up API credentials** for selected platforms
3. **Implement basic Zoom integration** (quickest to prototype)
4. **Test with real devices**
5. **Iterate based on feedback**

Would you like me to implement any specific integration first?
