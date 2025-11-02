from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api
import os
from dotenv import load_dotenv
from openai import OpenAI
import httpx

load_dotenv("../../backend/livekit-voice-agent/.env.local")

app = FastAPI()

# CORS middleware for web integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domains: ["https://yourdomain.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/token")
async def get_token(room_name: str = "voice-assistant", participant_name: str = "user"):
    """Generate a LiveKit access token for the client"""
    try:
        # Get credentials from environment
        api_key = os.getenv("LIVEKIT_API_KEY")
        api_secret = os.getenv("LIVEKIT_API_SECRET")
        livekit_url = os.getenv("LIVEKIT_URL")
        
        if not all([api_key, api_secret, livekit_url]):
            raise HTTPException(
                status_code=500, 
                detail="LiveKit credentials not configured. Check your .env.local file."
            )
        
        # Create token
        token = api.AccessToken(api_key, api_secret) \
            .with_identity(participant_name) \
            .with_name(participant_name) \
            .with_grants(api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            ))
        
        return {
            "token": token.to_jwt(),
            "url": livekit_url,
            "room": room_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}


# Chatbot models
class ChatMessage(BaseModel):
    message: str
    conversation_history: list = []


class ChatResponse(BaseModel):
    response: str


# Initialize Azure OpenAI client
openai_client = None
try:
    azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    azure_openai_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")  # Default deployment name
    azure_openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")  # Default API version
    
    if azure_openai_api_key and azure_openai_endpoint:
        # Construct the base URL for Azure OpenAI
        # Format: https://{resource}.openai.azure.com/openai/deployments/{deployment}
        base_url = f"{azure_openai_endpoint.rstrip('/')}/openai/deployments/{azure_openai_deployment}"
        openai_client = OpenAI(
            api_key=azure_openai_api_key,
            base_url=base_url
        )
        print(f"Azure OpenAI client initialized with deployment: {azure_openai_deployment}")
        print(f"Endpoint: {base_url}")
    else:
        print("Warning: Azure OpenAI credentials not configured. Check your .env.local file.")
        print("Required: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT")
except Exception as e:
    print(f"Warning: Azure OpenAI client not initialized: {e}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(chat_request: ChatMessage):
    """Handle chatbot messages using Azure OpenAI"""
    try:
        # Get credentials
        azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        
        if not azure_openai_api_key or not azure_openai_endpoint:
            return ChatResponse(
                response="I'm currently being set up. Please configure your Azure OpenAI credentials (AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT) in the .env.local file."
            )
        
        # System prompt for the chatbot
        system_prompt = """You are a helpful customer support assistant for GetMyQuotation, a platform that connects customers with verified suppliers for home interior and furniture needs.

Your role is to:
- Help customers understand how to get quotes for interior work and furniture
- Explain the platform's features (verified suppliers, no spam, fast responses)
- Assist with questions about pricing, timelines, and services
- Guide users to fill out the form to get rates from suppliers
- Be friendly, concise, and helpful

Keep responses conversational and under 150 words unless more detail is needed."""

        # Build conversation messages
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history if provided
        for msg in chat_request.conversation_history[-10:]:  # Keep last 10 messages
            if msg.get("type") == "user":
                messages.append({"role": "user", "content": msg.get("text", "")})
            elif msg.get("type") == "bot":
                messages.append({"role": "assistant", "content": msg.get("text", "")})
        
        # Add current message
        messages.append({"role": "user", "content": chat_request.message})
        
        # Call Azure OpenAI API directly using httpx
        azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        azure_openai_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
        azure_openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION")
        
        # Make the API call with api-version in the request
        async with httpx.AsyncClient() as client:
            api_url = f"{azure_openai_endpoint.rstrip('/')}/openai/deployments/{azure_openai_deployment}/chat/completions?api-version={azure_openai_api_version}"
            print(f"Calling Azure OpenAI: {api_url}")
            print(f"Deployment: {azure_openai_deployment}")
            
            response = await client.post(
                api_url,
                headers={
                    "api-key": azure_openai_api_key,
                    "Content-Type": "application/json"
                },
                json={
                    "messages": messages,
                    "max_completion_tokens": 1000,
                    "reasoning_effort": "low"  # For reasoning models: 'low', 'medium', or 'high'
                },
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            print(f"Azure OpenAI response: {result}")
            
            if "choices" not in result or len(result["choices"]) == 0:
                raise ValueError("No choices in Azure OpenAI response")
            
            choice = result["choices"][0]
            bot_response = choice["message"]["content"].strip() if choice["message"].get("content") else ""
            
            # Handle empty content (can happen with reasoning models)
            if not bot_response:
                finish_reason = choice.get("finish_reason", "unknown")
                print(f"Warning: Empty content received. Finish reason: {finish_reason}")
                if finish_reason == "length":
                    bot_response = "I apologize, but my response was cut off due to token limits. Could you please rephrase your question more concisely, or I can help with a simpler query?"
                else:
                    bot_response = "I apologize, but I'm having trouble generating a response. Please try again or rephrase your question."
            
            print(f"Bot response extracted: {bot_response[:100]}...")
        
        return ChatResponse(response=bot_response)
        
        
    except httpx.HTTPStatusError as e:
        error_detail = f"Azure OpenAI API error: {e.response.status_code} - {e.response.text}"
        print(f"Chat error: {error_detail}")
        raise HTTPException(
            status_code=500,
            detail=f"Error calling Azure OpenAI: {error_detail}"
        )
    except Exception as e:
        error_msg = str(e)
        print(f"Chat error: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat message: {error_msg}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)