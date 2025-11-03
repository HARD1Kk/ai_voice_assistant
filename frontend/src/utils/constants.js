// Quick reply options for the assistant
export const QUICK_REPLIES = [
  'Get quotes for sofa',
  'Find bedroom furniture',
  'Kitchen setup help',
  'Interior design consultation'
];

// Initial bot greeting message
export const INITIAL_BOT_MESSAGE = {
  type: 'bot',
  text: 'Hello! 👋 I\'m here to help you with your home interior and furniture needs. You can type or speak with me. How can I assist you today?',
  timestamp: new Date(),
  inputMethod: 'system'
};

// Voice connection statuses
export const VOICE_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  LISTENING: 'listening'
};

// Data packet types from LiveKit
export const DATA_TYPES = {
  TRANSCRIPTION: 'transcription',
  PARTIAL_TRANSCRIPTION: 'partial_transcription'
};

// Default configuration
export const DEFAULT_CONFIG = {
  tokenServerUrl: '/api/token',
  roomName: 'voice-assistant',
  participantName: 'user'
};
