from dotenv import load_dotenv
import json
import asyncio

from livekit import agents, rtc
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self, send_transcription_callback=None):
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
        self._send_transcription = send_transcription_callback
    
    async def respond(self, *args, **kwargs):
        """Override respond to capture and send transcription"""
        try:
            print(f"[AGENT_RESPOND] Called with args: {args}, kwargs: {kwargs}")
            response = await super().respond(*args, **kwargs)
            print(f"[AGENT_RESPOND] Response received: {response}, type: {type(response)}")
            
            # Try to extract text from response if it's a string
            if isinstance(response, str) and response.strip():
                print(f"[AGENT_RESPOND] Sending transcription from respond method: {response[:100]}...")
                if self._send_transcription:
                    await self._send_transcription("agent", response)
            
            # Also check if response has attributes that might contain the text
            if hasattr(response, 'content'):
                text = response.content
                if isinstance(text, str) and text.strip():
                    print(f"[AGENT_RESPOND] Sending transcription from response.content: {text[:100]}...")
                    if self._send_transcription:
                        await self._send_transcription("agent", text)
            elif hasattr(response, 'text'):
                text = response.text
                if isinstance(text, str) and text.strip():
                    print(f"[AGENT_RESPOND] Sending transcription from response.text: {text[:100]}...")
                    if self._send_transcription:
                        await self._send_transcription("agent", text)
            
            return response
        except Exception as e:
            print(f"[ERROR] Error in respond: {e}")
            import traceback
            traceback.print_exc()
            raise


async def entrypoint(ctx: agents.JobContext):
    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm="openai/gpt-4.1-mini",
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    # Track recent transcriptions to prevent duplicates (using closure to persist)
    _recent_transcriptions = {}  # {text: timestamp}
    
    # Helper function to send transcription to frontend with duplicate prevention
    async def send_transcription(sender: str, text: str):
        try:
            # Normalize text for duplicate detection
            normalized_text = text.strip().lower()
            import time
            now = time.time()
            
            # Check if we sent this exact transcription recently (within last 2 seconds)
            if normalized_text in _recent_transcriptions:
                last_sent = _recent_transcriptions[normalized_text]
                if now - last_sent < 2.0:
                    print(f"[TRANSCRIPTION] Duplicate prevented: {text[:50]}... (last sent {now - last_sent:.2f}s ago)")
                    return
            
            # Update tracking
            _recent_transcriptions[normalized_text] = now
            # Clean up old entries (older than 5 seconds)
            cutoff = now - 5.0
            keys_to_remove = [k for k, v in _recent_transcriptions.items() if v < cutoff]
            for k in keys_to_remove:
                del _recent_transcriptions[k]
            
            print(f"[TRANSCRIPTION] Sending {sender} transcription: {text[:100]}...")
            data = json.dumps({
                "type": "transcription",
                "sender": sender,
                "text": text
            })
            print(f"[TRANSCRIPTION] Data to send: {data[:200]}...")
            await ctx.room.local_participant.publish_data(
                data.encode(),
                reliable=True
            )
            print(f"[TRANSCRIPTION] Successfully sent {sender} transcription")
        except Exception as e:
            print(f"[ERROR] Error sending transcription: {e}")
            import traceback
            traceback.print_exc()

    # Data channel handler removed - text messages are handled separately via chat API

    # Create agent with transcription callback
    assistant = Assistant(send_transcription_callback=send_transcription)
    
    print("[SESSION] Starting session...")
    await session.start(
        room=ctx.room,
        agent=assistant,
        room_input_options=RoomInputOptions(
            # For telephony applications, use `BVCTelephony` instead for best results
            noise_cancellation=noise_cancellation.BVC(), 
        ),
    )
    print("[SESSION] Session started successfully")
    
    # After session starts, try to hook into the agent's voice handler if available
    try:
        # The session might have a _voice or _agent_voice attribute after starting
        if hasattr(session, '_voice') and session._voice:
            print("[SESSION] Found _voice attribute, attempting to hook...")
            if hasattr(session._voice, 'say'):
                original_voice_say = session._voice.say
                async def voice_say_with_transcription(*args, **kwargs):
                    text = None
                    if len(args) > 0 and isinstance(args[0], str):
                        text = args[0]
                    elif 'text' in kwargs:
                        text = kwargs['text']
                    if text:
                        print(f"[VOICE_SAY] Voice saying: {text[:100]}...")
                        await send_transcription("agent", text)
                    return await original_voice_say(*args, **kwargs)
                session._voice.say = voice_say_with_transcription
                print("[SESSION] Hooked into _voice.say method")
        
        # Also check for agent's voice handler
        if hasattr(assistant, '_voice') and assistant._voice:
            print("[SESSION] Found assistant._voice attribute, attempting to hook...")
            if hasattr(assistant._voice, 'say'):
                original_assistant_voice_say = assistant._voice.say
                async def assistant_voice_say_with_transcription(*args, **kwargs):
                    text = None
                    if len(args) > 0 and isinstance(args[0], str):
                        text = args[0]
                    elif 'text' in kwargs:
                        text = kwargs['text']
                    if text:
                        print(f"[ASSISTANT_VOICE_SAY] Assistant voice saying: {text[:100]}...")
                        await send_transcription("agent", text)
                    return await original_assistant_voice_say(*args, **kwargs)
                assistant._voice.say = assistant_voice_say_with_transcription
                print("[SESSION] Hooked into assistant._voice.say method")
        
        # Hook into the LLM's chat method to capture responses
        # Note: We can't easily hook into chat as it's an async context manager property
        # Instead, we'll rely on other methods like TTS hooks and SpeechHandle inspection
    except Exception as e:
        print(f"[WARNING] Could not hook into voice handlers: {e}")
        import traceback
        traceback.print_exc()
    
    # Hook into user speech events to send user transcriptions
    print("[SESSION] Setting up event handlers...")
    try:
        # Wrap async handler in sync callback
        def on_user_speech_sync(event):
            async def on_user_speech_async():
                try:
                    print(f"[USER_SPEECH] Event received: {event}")
                    if hasattr(event, 'alternatives') and event.alternatives:
                        user_text = event.alternatives[0].text
                        print(f"[USER_SPEECH] User speech committed: {user_text}")
                        await send_transcription("user", user_text)
                    else:
                        print(f"[USER_SPEECH] Event structure: {dir(event)}")
                except Exception as e:
                    print(f"[ERROR] Error in user_speech handler: {e}")
                    import traceback
                    traceback.print_exc()
            asyncio.create_task(on_user_speech_async())
        
        session.on("user_speech_committed", on_user_speech_sync)
        print("[SESSION] User speech handler registered")
    except Exception as e:
        print(f"[WARNING] Could not set up user_speech handler: {e}")
        import traceback
        traceback.print_exc()
    
    # Hook into agent speech committed events (similar to user_speech_committed)
    try:
        def on_agent_speech_committed_sync(event):
            async def on_agent_speech_committed_async():
                try:
                    print(f"[AGENT_SPEECH_COMMITTED] Event received: {event}")
                    # Try to extract text from event similar to user speech
                    if hasattr(event, 'alternatives') and event.alternatives:
                        agent_text = event.alternatives[0].text
                        print(f"[AGENT_SPEECH_COMMITTED] Agent speech committed: {agent_text}")
                        await send_transcription("agent", agent_text)
                    elif hasattr(event, 'text'):
                        agent_text = event.text
                        print(f"[AGENT_SPEECH_COMMITTED] Agent speech text: {agent_text}")
                        await send_transcription("agent", agent_text)
                    else:
                        print(f"[AGENT_SPEECH_COMMITTED] Event structure: {dir(event)}")
                except Exception as e:
                    print(f"[ERROR] Error in agent_speech_committed handler: {e}")
                    import traceback
                    traceback.print_exc()
            asyncio.create_task(on_agent_speech_committed_async())
        
        try:
            session.on("agent_speech_committed", on_agent_speech_committed_sync)
            print("[SESSION] Agent speech committed handler registered")
        except Exception as e:
            print(f"[INFO] agent_speech_committed event not available: {e}")
    except Exception as e:
        print(f"[WARNING] Could not set up agent_speech_committed handler: {e}")

    # Hook into agent's response to capture text before TTS
    # Try multiple approaches to capture the agent's speech text
    
    # Approach 1: Monitor agent's say method directly (this is the method that sends text to TTS)
    try:
        if hasattr(assistant, 'say'):
            original_say = assistant.say
            
            async def say_with_transcription(text: str, **kwargs):
                print(f"[SAY] Agent saying: {text[:100]}...")
                await send_transcription("agent", text)
                return await original_say(text, **kwargs)
            
            assistant.say = say_with_transcription
            print("[SESSION] Hooked into agent say method")
        else:
            print("[SESSION] Agent does not have say method")
            
        # Also check if there's a _say or synthesize method
        if hasattr(assistant, '_say'):
            original_say = assistant._say
            async def _say_with_transcription(text: str, **kwargs):
                print(f"[_SAY] Agent saying: {text[:100]}...")
                await send_transcription("agent", text)
                return await original_say(text, **kwargs)
            assistant._say = _say_with_transcription
            print("[SESSION] Hooked into agent _say method")
    except Exception as e:
        print(f"[WARNING] Could not hook into agent say: {e}")
        import traceback
        traceback.print_exc()
    
    # Approach 2: Hook into TTS synthesis events if available
    try:
        if hasattr(session, '_tts') and session._tts:
            original_synthesize = None
            if hasattr(session._tts, 'synthesize'):
                original_synthesize = session._tts.synthesize
                
                async def synthesize_with_transcription(*args, **kwargs):
                    # TTS synthesize might receive text as first arg or in kwargs
                    text = None
                    if len(args) > 0 and isinstance(args[0], str):
                        text = args[0]
                    elif 'text' in kwargs:
                        text = kwargs['text']
                    elif 'input' in kwargs:
                        text = kwargs['input']
                    elif 'message' in kwargs:
                        text = kwargs['message']
                    
                    if text:
                        print(f"[TTS_SYNTHESIZE] TTS synthesizing: {text[:100]}...")
                        await send_transcription("agent", text)
                    else:
                        print(f"[TTS_SYNTHESIZE] TTS synthesize called but no text found. Args: {args}, kwargs: {list(kwargs.keys())}")
                    
                    return await original_synthesize(*args, **kwargs)
                
                session._tts.synthesize = synthesize_with_transcription
                print("[SESSION] Hooked into TTS synthesize method")
            
            # Also try other possible method names
            for method_name in ['say', '_synthesize', 'synthesize_speech', 'text_to_speech']:
                if hasattr(session._tts, method_name):
                    original_method = getattr(session._tts, method_name)
                    # Use a lambda or factory function to capture method_name properly
                    def make_wrapper(mname, orig):
                        async def wrapped_method(*args, **kwargs):
                            text = None
                            if len(args) > 0 and isinstance(args[0], str):
                                text = args[0]
                            elif 'text' in kwargs:
                                text = kwargs['text']
                            if text:
                                print(f"[TTS_{mname.upper()}] {mname} called with text: {text[:100]}...")
                                await send_transcription("agent", text)
                            return await orig(*args, **kwargs)
                        return wrapped_method
                    setattr(session._tts, method_name, make_wrapper(method_name, original_method))
                    print(f"[SESSION] Hooked into TTS {method_name} method")
    except Exception as e:
        print(f"[WARNING] Could not hook into TTS: {e}")
        import traceback
        traceback.print_exc()
    
    # Approach 3: Monitor agent speech events
    try:
        def on_agent_speech_sync(event):
            async def on_agent_speech_async():
                try:
                    print(f"[AGENT_SPEECH] Event received: {event}")
                    # Try to extract text from event
                    if hasattr(event, 'text'):
                        await send_transcription("agent", event.text)
                    elif hasattr(event, 'message'):
                        await send_transcription("agent", event.message)
                    elif hasattr(event, 'data'):
                        data = event.data
                        if isinstance(data, str):
                            await send_transcription("agent", data)
                except Exception as e:
                    print(f"[ERROR] Error in agent_speech handler: {e}")
                    import traceback
                    traceback.print_exc()
            asyncio.create_task(on_agent_speech_async())
        
        # Try different event names that might be used for agent speech
        try:
            session.on("agent_speech", on_agent_speech_sync)
            print("[SESSION] Registered agent_speech event handler")
        except:
            pass
        try:
            session.on("agent_speech_started", on_agent_speech_sync)
            print("[SESSION] Registered agent_speech_started event handler")
        except:
            pass
    except Exception as e:
        print(f"[WARNING] Could not set up agent_speech handler: {e}")

    # Override generate_reply to capture agent responses from conversation history
    print("[SESSION] Overriding generate_reply...")
    original_generate_reply = session.generate_reply
    
    async def generate_reply_with_transcription(*args, **kwargs):
        print(f"[GENERATE_REPLY] Called with args: {len(args)}, kwargs: {list(kwargs.keys())}")
        result = await original_generate_reply(*args, **kwargs)
        print(f"[GENERATE_REPLY] Returned: type={type(result)}, value={result}")
        
        # Try to extract text from SpeechHandle if that's what we got
        if result:
            print(f"[GENERATE_REPLY] SpeechHandle attributes: {[attr for attr in dir(result) if not attr.startswith('__')]}")
            
            # Set up a callback to monitor when items are added to chat_items
            async def on_item_added(item):
                try:
                    print(f"[SPEECH_HANDLE] Item added: {type(item)}")
                    # Try to extract text from the added item
                    if hasattr(item, 'content'):
                        text = item.content
                        if isinstance(text, str) and text.strip():
                            print(f"[SPEECH_HANDLE] Found text in added item.content: {text[:100]}...")
                            await send_transcription("agent", text)
                    elif hasattr(item, 'text'):
                        text = item.text
                        if isinstance(text, str) and text.strip():
                            print(f"[SPEECH_HANDLE] Found text in added item.text: {text[:100]}...")
                            await send_transcription("agent", text)
                    elif isinstance(item, dict):
                        if 'content' in item:
                            text = item['content']
                            if isinstance(text, str) and text.strip():
                                print(f"[SPEECH_HANDLE] Found text in added item[content]: {text[:100]}...")
                                await send_transcription("agent", text)
                except Exception as e:
                    print(f"[SPEECH_HANDLE] Error in item_added callback: {e}")
            
            # Register callback if available
            if hasattr(result, '_add_item_added_callback'):
                result._add_item_added_callback(on_item_added)
                print("[GENERATE_REPLY] Registered item_added callback")
            elif hasattr(result, 'add_item_added_callback'):
                result.add_item_added_callback(on_item_added)
                print("[GENERATE_REPLY] Registered item_added callback")
            
            # Check chat_items - this might contain the text messages!
            if hasattr(result, 'chat_items'):
                try:
                    chat_items = result.chat_items
                    print(f"[GENERATE_REPLY] Found chat_items: {type(chat_items)}, length: {len(chat_items) if hasattr(chat_items, '__len__') else 'N/A'}")
                    if chat_items:
                        for idx, item in enumerate(chat_items):
                            print(f"[GENERATE_REPLY] Chat item {idx}: {type(item)}")
                            # Try to extract text from chat items
                            if hasattr(item, 'content'):
                                text = item.content
                                if isinstance(text, str) and text.strip():
                                    print(f"[GENERATE_REPLY] Found text in chat_items[{idx}].content: {text[:100]}...")
                                    await send_transcription("agent", text)
                            elif hasattr(item, 'text'):
                                text = item.text
                                if isinstance(text, str) and text.strip():
                                    print(f"[GENERATE_REPLY] Found text in chat_items[{idx}].text: {text[:100]}...")
                                    await send_transcription("agent", text)
                            elif isinstance(item, dict):
                                if 'content' in item:
                                    text = item['content']
                                    if isinstance(text, str) and text.strip():
                                        print(f"[GENERATE_REPLY] Found text in chat_items[{idx}][content]: {text[:100]}...")
                                        await send_transcription("agent", text)
                except Exception as e:
                    print(f"[GENERATE_REPLY] Error accessing chat_items: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Try different possible attributes
            for attr_name in ['text', 'message', 'content', 'transcript', 'response', '_text', '_message']:
                if hasattr(result, attr_name):
                    attr_value = getattr(result, attr_name)
                    if isinstance(attr_value, str) and attr_value.strip():
                        print(f"[GENERATE_REPLY] Found text in SpeechHandle.{attr_name}: {attr_value[:100]}...")
                        await send_transcription("agent", attr_value)
                        break
            
            # Also try accessing through any underlying objects
            if hasattr(result, '_message'):
                msg = result._message
                if hasattr(msg, 'content'):
                    text = msg.content
                    if isinstance(text, str) and text.strip():
                        print(f"[GENERATE_REPLY] Found text in SpeechHandle._message.content: {text[:100]}...")
                        await send_transcription("agent", text)
            elif hasattr(result, 'message') and hasattr(result.message, 'content'):
                text = result.message.content
                if isinstance(text, str) and text.strip():
                    print(f"[GENERATE_REPLY] Found text in SpeechHandle.message.content: {text[:100]}...")
                    await send_transcription("agent", text)
        
        # Try to extract the agent's response from the conversation history
        # Wait a bit longer for the response to be generated and added to conversation
        await asyncio.sleep(1.0)  # Increased delay to ensure response is in conversation
        
        try:
            # Check the agent's conversation history for the last assistant message
            if hasattr(assistant, '_llm') and assistant._llm:
                # Check if the LLM has a conversation or chat history
                if hasattr(assistant._llm, 'chat') or hasattr(assistant._llm, 'conversation'):
                    print("[GENERATE_REPLY] Attempting to access LLM conversation...")
                    
            # Alternative: Check the session's LLM conversation
            if hasattr(session, '_llm') and session._llm:
                try:
                    print(f"[GENERATE_REPLY] Checking session._llm: {type(session._llm)}")
                    print(f"[GENERATE_REPLY] session._llm attributes: {[attr for attr in dir(session._llm) if not attr.startswith('__')]}")
                    
                    # The LLM has a 'chat' attribute which is likely an async context manager
                    # We need to access the conversation history through it
                    # Try accessing internal state
                    messages = None
                    
                    # Check if there's a conversation manager with messages
                    if hasattr(session._llm, 'chat'):
                        chat_obj = session._llm.chat
                        print(f"[GENERATE_REPLY] chat object type: {type(chat_obj)}")
                        print(f"[GENERATE_REPLY] chat attributes: {[attr for attr in dir(chat_obj) if not attr.startswith('__')]}")
                        
                        # Try to access messages through chat object
                        if hasattr(chat_obj, '_messages'):
                            messages = chat_obj._messages
                            print(f"[GENERATE_REPLY] Found chat._messages: {len(messages) if messages else 0}")
                        elif hasattr(chat_obj, 'messages'):
                            messages = chat_obj.messages
                            print(f"[GENERATE_REPLY] Found chat.messages: {len(messages) if messages else 0}")
                    
                    # Also try direct access
                    if not messages:
                        if hasattr(session._llm, '_messages'):
                            messages = session._llm._messages
                            print(f"[GENERATE_REPLY] Found _messages: {len(messages) if messages else 0}")
                        elif hasattr(session._llm, 'messages'):
                            messages = session._llm.messages
                            print(f"[GENERATE_REPLY] Found messages: {len(messages) if messages else 0}")
                        elif hasattr(session._llm, 'history'):
                            messages = session._llm.history
                            print(f"[GENERATE_REPLY] Found history: {len(messages) if messages else 0}")
                    
                    if messages and len(messages) > 0:
                        print(f"[GENERATE_REPLY] Total messages found: {len(messages)}")
                        # Search for the last assistant message (might not be the very last one)
                        for idx, msg in enumerate(reversed(messages)):
                            msg_role = None
                            msg_content = None
                            
                            if isinstance(msg, dict):
                                msg_role = msg.get('role')
                                msg_content = msg.get('content')
                                print(f"[GENERATE_REPLY] Message {idx}: dict with role={msg_role}, content length={len(str(msg_content)) if msg_content else 0}")
                            elif hasattr(msg, 'role'):
                                msg_role = msg.role
                                if hasattr(msg, 'content'):
                                    msg_content = msg.content
                                elif hasattr(msg, 'text'):
                                    msg_content = msg.text
                                print(f"[GENERATE_REPLY] Message {idx}: object with role={msg_role}, content length={len(str(msg_content)) if msg_content else 0}")
                            
                            if msg_role and (msg_role == 'assistant' or str(msg_role).lower() == 'assistant'):
                                if msg_content and isinstance(msg_content, str) and msg_content.strip():
                                    print(f"[GENERATE_REPLY] Found assistant message: {msg_content[:100]}...")
                                    await send_transcription("agent", msg_content)
                                    break
                    else:
                        print(f"[GENERATE_REPLY] No messages found in LLM conversation")
                except Exception as e:
                    print(f"[GENERATE_REPLY] Error accessing LLM messages: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Also check assistant's LLM if different from session
            if hasattr(assistant, '_llm') and assistant._llm and assistant._llm != getattr(session, '_llm', None):
                try:
                    print(f"[GENERATE_REPLY] Checking assistant._llm: {type(assistant._llm)}")
                    messages = None
                    if hasattr(assistant._llm, '_messages'):
                        messages = assistant._llm._messages
                    elif hasattr(assistant._llm, 'messages'):
                        messages = assistant._llm.messages
                    
                    if messages and len(messages) > 0:
                        for msg in reversed(messages):
                            msg_role = None
                            msg_content = None
                            
                            if isinstance(msg, dict):
                                msg_role = msg.get('role')
                                msg_content = msg.get('content')
                            elif hasattr(msg, 'role'):
                                msg_role = msg.role
                                if hasattr(msg, 'content'):
                                    msg_content = msg.content
                            
                            if msg_role and (msg_role == 'assistant' or str(msg_role).lower() == 'assistant'):
                                if msg_content and isinstance(msg_content, str) and msg_content.strip():
                                    print(f"[GENERATE_REPLY] Found assistant message in assistant._llm: {msg_content[:100]}...")
                                    await send_transcription("agent", msg_content)
                                    break
                except Exception as e:
                    print(f"[GENERATE_REPLY] Error accessing assistant LLM messages: {e}")
            
            # Also try accessing through assistant's conversation if available
            if hasattr(assistant, 'conversation'):
                try:
                    conv = assistant.conversation
                    if hasattr(conv, 'messages'):
                        messages = conv.messages
                        if messages and len(messages) > 0:
                            # Find the last assistant message
                            for msg in reversed(messages):
                                if hasattr(msg, 'role') and (msg.role == 'assistant' or str(msg.role).lower() == 'assistant'):
                                    if hasattr(msg, 'content'):
                                        agent_text = msg.content
                                        print(f"[GENERATE_REPLY] Found assistant message in conversation: {agent_text[:100]}...")
                                        await send_transcription("agent", agent_text)
                                        break
                except Exception as e:
                    print(f"[GENERATE_REPLY] Error accessing assistant conversation: {e}")
        except Exception as e:
            print(f"[GENERATE_REPLY] Error checking conversation history: {e}")
            import traceback
            traceback.print_exc()
        
        return result
    
    session.generate_reply = generate_reply_with_transcription
    print("[SESSION] generate_reply overridden")
    
    print("[SESSION] Sending initial greeting...")
    await session.generate_reply(
        instructions="Greet the user warmly and introduce yourself as a GetMyQuotation assistant. Offer to help them with home interior and furniture needs, and mention that you can help them get quotes from verified suppliers."
    )
    print("[SESSION] Initial greeting sent")


if __name__ == "__main__":
    # Increase timeout for Windows compatibility
    # Default is 10 seconds, increasing to 60 seconds for Windows IPC limitations
    worker_options = agents.WorkerOptions(
        entrypoint_fnc=entrypoint,
        initialize_process_timeout=60.0,  # 60 seconds for Windows
    )
    agents.cli.run_app(worker_options)