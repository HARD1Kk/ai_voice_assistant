# AI Voice Assistant

An AI-powered voice and chat assistant for GetMyQuotation platform, built with LiveKit for real-time voice communication and Azure OpenAI for intelligent conversational responses.

## 🎯 Project Overview

This project provides a customer support assistant that helps users understand how to get quotes for interior work and furniture through the GetMyQuotation platform. The assistant is available in two modes:

- **Voice Assistant**: Real-time voice conversation using LiveKit
- **Chatbot**: Text-based chat interface using Azure OpenAI

## 📁 Project Structure

```
Ai_voice_assistant/
├── backend/
│   ├── livekit-voice-agent/     # LiveKit voice agent implementation
│   │   ├── agent.py              # Main agent logic
│   │   ├── pyproject.toml        # Python dependencies (uv)
│   │   ├── uv.lock               # Lock file
│   │   └── .env.local            # Environment variables (create this)
│   └── token-server/             # FastAPI server for tokens and chat API
│       ├── server.py             # Token generation and chat endpoints
│       └── requirements.txt      # Python dependencies
├── frontend/                      # React frontend application
│   ├── src/
│   │   ├── App.jsx               # Main app component
│   │   ├── HomePage.jsx          # Landing page
│   │   ├── Chatbot.jsx           # Chat interface component
│   │   ├── VoiceAssistant.jsx   # Voice assistant component
│   │   └── *.css                 # Component styles
│   ├── index.html                # HTML entry point
│   ├── package.json              # Node.js dependencies
│   └── vite.config.js            # Vite configuration
└── README.md                      # This file
```

## ✨ Features

- **Real-time Voice Communication**: Powered by LiveKit for high-quality audio streaming
- **Intelligent Chat Interface**: Text-based chatbot using Azure OpenAI
- **Multi-modal Support**: Switch between voice and chat modes
- **Advanced Voice Processing**: 
  - Noise cancellation (BVC)
  - Voice activity detection (Silero VAD)
  - Turn detection for natural conversations
  - Speech-to-text (AssemblyAI Universal Streaming)
  - Text-to-speech (Cartesia Sonic)
- **Customer Support Focus**: Specialized for GetMyQuotation platform queries

## 🔧 Prerequisites

- **Python 3.11** or **3.12** (for backend services)
- **Node.js 18+** and **npm** (for frontend)
- **uv** (Python package manager) - Install from [https://github.com/astral-sh/uv](https://github.com/astral-sh/uv)
- **LiveKit Cloud** account or self-hosted LiveKit server
- **Azure OpenAI** account with API access
- **OpenAI API Key** (for voice agent LLM)

## 📋 Environment Variables

Create a `.env.local` file in `backend/livekit-voice-agent/` with the following variables:

### LiveKit Configuration
```env
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-livekit-server.com
```

### Azure OpenAI Configuration (for Chatbot)
```env
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### OpenAI Configuration (for Voice Agent LLM)
```env
OPENAI_API_KEY=your_openai_api_key
```

## 🚀 Setup Instructions

### 1. Backend Setup

#### LiveKit Voice Agent

```bash
cd backend/livekit-voice-agent

# Install dependencies using uv
uv sync

# Create .env.local file with required environment variables
# (See Environment Variables section above)
```

#### Token Server

```bash
cd backend/token-server

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## ▶️ Running the Project

### Terminal 1: LiveKit Voice Agent
```bash
cd backend/livekit-voice-agent
uv run livekit-agents dev
```

### Terminal 2: Token Server (FastAPI)
```bash
cd backend/token-server
# Activate virtual environment first
python server.py
# Or use uvicorn directly:
uvicorn server:app --reload --port 8000
```

### Terminal 3: Frontend Development Server
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in the terminal).

## 🔌 API Endpoints

### Token Server Endpoints

- `GET /api/token` - Generate LiveKit access token
  - Query params: `room_name` (default: "voice-assistant"), `participant_name` (default: "user")
  
- `POST /api/chat` - Send chat message to AI assistant
  - Body: `{ "message": "your message", "conversation_history": [...] }`
  - Response: `{ "response": "ai response" }`

- `GET /health` - Health check endpoint

## 🏗️ Architecture

### Voice Assistant Flow

1. User clicks voice assistant button in the frontend
2. Frontend requests token from token server (`/api/token`)
3. Frontend connects to LiveKit room using the token
4. Voice agent (backend) joins the room when user starts speaking
5. Real-time audio streaming: User ↔ LiveKit ↔ Voice Agent
6. Voice agent processes audio, generates responses, and streams back

### Chatbot Flow

1. User sends message in chat interface
2. Frontend sends POST request to `/api/chat`
3. Token server forwards request to Azure OpenAI
4. Response is sent back to frontend and displayed

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite
- **Backend Voice Agent**: LiveKit Agents Framework, Python
- **Token Server**: FastAPI, Uvicorn
- **Voice Services**: 
  - LiveKit (real-time communication)
  - AssemblyAI (speech-to-text)
  - Cartesia (text-to-speech)
  - Silero (voice activity detection)
- **AI Services**:
  - Azure OpenAI (chatbot)
  - OpenAI GPT-4.1-mini (voice agent LLM)

## 📝 Development Notes

- The voice agent uses multilingual turn detection for natural conversation flow
- Noise cancellation (BVC) is enabled for better audio quality
- Windows compatibility: Process timeout is set to 60 seconds (see `agent.py`)
- Token server loads environment variables from `../livekit-voice-agent/.env.local`

## 🔒 Security Notes

- In production, update CORS settings in `token-server/server.py` to specify allowed origins
- Never commit `.env.local` files to version control
- Use secure API key storage and management in production

## 📚 Additional Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [React Documentation](https://react.dev/)

## 🤝 Contributing

1. Ensure all environment variables are configured
2. Follow the existing code structure
3. Test voice and chat functionality before submitting changes

## 📄 License

[Add your license information here]

