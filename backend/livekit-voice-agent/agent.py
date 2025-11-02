from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful customer support assistant for GetMyQuotation, a platform that connects customers with verified suppliers for home interior and furniture needs.

Your role is to:
- Help customers understand how to get quotes for interior work and furniture
- Explain the platform's features (verified suppliers, no spam, fast responses, 500+ suppliers across Delhi NCR)
- Assist with questions about pricing, timelines, and services
- Guide users to fill out the form to get rates from suppliers
- Be friendly, concise, and helpful

Keep responses conversational, natural, and under 100 words. Speak in a friendly, professional tone. Do not use complex formatting, emojis, asterisks, or other symbols in your speech.""",
        )


async def entrypoint(ctx: agents.JobContext):
    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm="openai/gpt-4.1-mini",
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            # For telephony applications, use `BVCTelephony` instead for best results
            noise_cancellation=noise_cancellation.BVC(), 
        ),
    )

    await session.generate_reply(
        instructions="Greet the user warmly and introduce yourself as a GetMyQuotation assistant. Offer to help them with home interior and furniture needs, and mention that you can help them get quotes from verified suppliers."
    )


if __name__ == "__main__":
    # Increase timeout for Windows compatibility
    # Default is 10 seconds, increasing to 60 seconds for Windows IPC limitations
    worker_options = agents.WorkerOptions(
        entrypoint_fnc=entrypoint,
        initialize_process_timeout=60.0,  # 60 seconds for Windows
    )
    agents.cli.run_app(worker_options)