import React, { useState, useRef, useEffect } from 'react';
import { Track, RemoteParticipant, DataPacket_Kind } from 'livekit-client';
import { sendChatMessage, getLiveKitToken } from '../../services/api';
import { createRoom, setupRoomEventListeners, attachAudioTrack, detachAudioTrack, isMicrophoneAudioTrack } from '../../services/livekit';
import { QUICK_REPLIES, INITIAL_BOT_MESSAGE, VOICE_STATUS, DATA_TYPES, DEFAULT_CONFIG } from '../../utils/constants';
import '../../styles/components/UnifiedAssistant.css';

const UnifiedAssistant = ({ 
  tokenServerUrl = DEFAULT_CONFIG.tokenServerUrl,
  roomName = DEFAULT_CONFIG.roomName,
  participantName = DEFAULT_CONFIG.participantName
}) => {
  // Chat state
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_BOT_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Voice state
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(VOICE_STATUS.DISCONNECTED);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [agentParticipant, setAgentParticipant] = useState(null);
  
  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const roomRef = useRef(null);
  const audioElementsRef = useRef([]);
  const transcriptionBufferRef = useRef('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentTranscription]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      cleanupAudio();
    };
  }, []);

  const createMessage = (type, text, inputMethod = 'text') => ({
    type,
    text,
    timestamp: new Date(),
    inputMethod,
    id: `msg-${Date.now()}-${Math.random()}`
  });

  const isDuplicateMessage = (messages, newMessage, timeWindow = 10000) => {
    const normalizedText = newMessage.text.trim().toLowerCase();
    const now = new Date().getTime();
    return messages.some(msg => {
      const sameType = msg.type === newMessage.type;
      const sameText = msg.text.trim().toLowerCase() === normalizedText;
      const withinTimeWindow = Math.abs(msg.timestamp.getTime() - now) < timeWindow;
      return sameType && sameText && withinTimeWindow;
    });
  };

  const handleDataReceived = (data, participant) => {
    console.log('[DEBUG] Data received:', { type: data.type, sender: data.sender, text: data.text?.substring(0, 50) });
    
    // Handle transcription data
    if (data.type === DATA_TYPES.TRANSCRIPTION) {
      if (data.sender === 'user') {
        setCurrentTranscription(data.text);
        transcriptionBufferRef.current = data.text;
        setMessages(prev => {
          const newMessage = createMessage('user', data.text, 'voice');
          if (!isDuplicateMessage(prev, newMessage, 0)) {
            return [...prev, newMessage];
          }
          console.log('[DEBUG] Duplicate user message prevented:', data.text);
          return prev;
        });
      } else if (data.sender === 'agent') {
        console.log('[DEBUG] Adding agent message to chat:', data.text?.substring(0, 50));
        setMessages(prev => {
          const newMessage = createMessage('bot', data.text, 'voice');
          if (!isDuplicateMessage(prev, newMessage, 10000)) {
            return [...prev, newMessage];
          }
          console.log('[DEBUG] Duplicate agent message prevented:', data.text?.substring(0, 50));
          return prev;
        });
        setIsAgentSpeaking(false);
        setIsTyping(false);
      }
    }
    
    // Handle partial transcriptions
    if (data.type === DATA_TYPES.PARTIAL_TRANSCRIPTION && data.sender === 'user') {
      setCurrentTranscription(data.text);
    }
  };

  // Voice connection
  const connectVoice = async () => {
    if (isVoiceConnecting || isVoiceConnected) return;

    setIsVoiceConnecting(true);
    setVoiceStatus(VOICE_STATUS.CONNECTING);

    try {
      const { token, url } = await getLiveKitToken(tokenServerUrl, roomName, participantName);
      const room = createRoom();
      roomRef.current = room;

      setupRoomEventListeners(room, {
        onDataReceived: handleDataReceived,
        onConnected: () => {
          console.log('[CONNECTION] ✅ Connected to room');
          setIsVoiceConnected(true);
          setIsVoiceConnecting(false);
          setVoiceStatus(VOICE_STATUS.CONNECTED);
        },
        onDisconnected: () => {
          console.log('Disconnected from room');
          setIsVoiceConnected(false);
          setVoiceStatus(VOICE_STATUS.DISCONNECTED);
          setIsAgentSpeaking(false);
          setAgentParticipant(null);
          cleanupAudio();
        },
        onParticipantConnected: (participant) => {
          console.log('Participant connected:', participant.identity);
          if (participant instanceof RemoteParticipant && !agentParticipant) {
            setAgentParticipant(participant);
            
            participant.on('trackSubscribed', (track) => {
              if (isMicrophoneAudioTrack(track)) {
                setIsAgentSpeaking(true);
                track.on('muted', () => setIsAgentSpeaking(false));
                track.on('unmuted', () => setIsAgentSpeaking(true));
              }
            });
          }
        },
        onTrackSubscribed: (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const audioElement = attachAudioTrack(track);
            audioElementsRef.current.push(audioElement);
            
            if (participant && participant.identity !== participantName) {
              setIsListening(true);
              setVoiceStatus(VOICE_STATUS.LISTENING);
              setIsAgentSpeaking(!track.isMuted);
            }
          }
        },
        onTrackUnsubscribed: (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            detachAudioTrack(track);
            if (participant && participant.identity !== participantName) {
              setIsAgentSpeaking(false);
            }
          }
        },
        onLocalTrackPublished: (publication) => {
          if (publication.track && publication.track.kind === Track.Kind.Audio) {
            console.log('User microphone published');
          }
        }
      });

      console.log('[CONNECTION] Attempting to connect to room...');
      await room.connect(url, token);
      console.log('[CONNECTION] Room.connect() completed');
      
      // Enable microphone
      console.log('[CONNECTION] Enabling microphone...');
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log('[CONNECTION] Microphone enabled');
      
      // Wait a bit for agent to connect
      setTimeout(() => {
        const remoteParticipants = Array.from(room.remoteParticipants.values());
        if (remoteParticipants.length > 0) {
          setAgentParticipant(remoteParticipants[0]);
        }
      }, 2000);
      
    } catch (err) {
      console.error('Voice connection error:', err);
      setIsVoiceConnecting(false);
      setIsVoiceConnected(false);
      setVoiceStatus(VOICE_STATUS.DISCONNECTED);
    }
  };

  const disconnectVoice = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    cleanupAudio();
    setIsVoiceConnected(false);
    setIsListening(false);
    setIsAgentSpeaking(false);
    setAgentParticipant(null);
    setVoiceStatus(VOICE_STATUS.DISCONNECTED);
    setCurrentTranscription('');
    transcriptionBufferRef.current = '';
  };

  const cleanupAudio = () => {
    audioElementsRef.current.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    audioElementsRef.current = [];
  };

  const toggleVoice = () => {
    if (isVoiceConnected) {
      disconnectVoice();
    } else {
      connectVoice();
    }
  };

  // Send text message (always uses chat API, independent of voice connection)
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userInputText = inputValue;
    setInputValue('');
    setCurrentTranscription('');
    
    const userMessage = createMessage('user', userInputText, 'text');
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const conversationHistory = messages.map(msg => ({
        type: msg.type,
        text: msg.text
      }));

      const data = await sendChatMessage(userInputText, conversationHistory);
      
      setMessages(prev => {
        const botMessage = createMessage('bot', data.response, 'text');
        if (!isDuplicateMessage(prev, botMessage, 0)) {
          return [...prev, botMessage];
        }
        return prev;
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, createMessage('bot', 'Sorry, I encountered an error. Please try again.', 'text')]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickReply = async (reply) => {
    if (isTyping) return;

    const userMessage = createMessage('user', reply, 'text');
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const conversationHistory = messages.map(msg => ({
        type: msg.type,
        text: msg.text
      }));

      const data = await sendChatMessage(reply, conversationHistory);
      
      setMessages(prev => {
        const botMessage = createMessage('bot', data.response, 'text');
        if (!isDuplicateMessage(prev, botMessage, 0)) {
          return [...prev, botMessage];
        }
        return prev;
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, createMessage('bot', 'Sorry, I encountered an error. Please try again.', 'text')]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <div className={`unified-assistant-button ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        {!isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="unified-assistant-window">
          <div className="unified-assistant-header">
            <div className="unified-assistant-header-content">
              <div className="unified-assistant-avatar">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div className="unified-assistant-header-text">
                <h3>AI Assistant</h3>
                <p className="status-text">
                  {isVoiceConnected 
                    ? (isAgentSpeaking 
                        ? '🎤 Agent speaking...' 
                        : isListening 
                          ? '🎤 Listening...' 
                          : '🎤 Connected')
                    : 'Type or speak'}
                </p>
              </div>
            </div>
            <button className="minimize-btn" onClick={() => setIsOpen(false)} aria-label="Minimize">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          <div className="unified-assistant-messages">
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`message ${msg.type}`}>
                {msg.type === 'bot' && (
                  <div className="message-avatar">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                )}
                <div className="message-content">
                  <div className="message-text">{msg.text}</div>
                  {msg.inputMethod === 'voice' && (
                    <div className="voice-badge">🎤 Voice</div>
                  )}
                  <div className="message-time">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Live transcription display - only show if not already in messages */}
            {currentTranscription && !messages.some(msg => 
              msg.type === 'user' && msg.text === currentTranscription && msg.inputMethod === 'voice'
            ) && (
              <div className="message user">
                <div className="message-content">
                  <div className="message-text transcription">
                    {currentTranscription}
                    <span className="recording-indicator">●</span>
                  </div>
                  <div className="voice-badge">🎤 Listening...</div>
                </div>
              </div>
            )}
            
            {/* Show when agent is speaking */}
            {isAgentSpeaking && (
              <div className="message bot">
                <div className="message-avatar">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="voice-badge">🎤 Speaking...</div>
                </div>
              </div>
            )}

            {isTyping && (
              <div className="message bot">
                <div className="message-avatar">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="quick-replies">
              <p className="quick-replies-title">Quick replies:</p>
              <div className="quick-replies-buttons">
                {QUICK_REPLIES.map((reply, idx) => (
                  <button
                    key={idx}
                    className="quick-reply-btn"
                    onClick={() => handleQuickReply(reply)}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form className="unified-assistant-input-form" onSubmit={handleSend}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isVoiceConnected ? "Type your message or speak... (Voice + Chat)" : "Type your message..."}
              className="unified-assistant-input"
              disabled={isTyping}
            />
            <button
              type="button"
              className={`voice-button-input ${isVoiceConnected ? (isListening ? 'listening' : 'connected') : ''}`}
              onClick={toggleVoice}
              disabled={isVoiceConnecting}
              title={isVoiceConnected ? "Stop voice" : "Start voice"}
            >
              {isVoiceConnecting ? (
                <div className="voice-button-spinner"></div>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </button>
            <button 
              type="submit" 
              className="send-button" 
              disabled={!inputValue.trim() || isTyping}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default UnifiedAssistant;
