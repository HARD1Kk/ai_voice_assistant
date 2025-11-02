import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track, TrackPublication, Participant } from 'livekit-client';
import './VoiceAssistant.css';

const VoiceAssistant = ({ 
  tokenServerUrl = '/api/token',
  roomName = 'voice-assistant',
  participantName = 'user',
  position = 'bottom-right' // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [error, setError] = useState(null);
  const roomRef = useRef(null);
  const audioElementsRef = useRef([]);

  const connect = async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setStatus('connecting');
    setError(null);

    try {
      // Get access token from server
      const response = await fetch(
        `${tokenServerUrl}?room_name=${roomName}&participant_name=${participantName}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.statusText}`);
      }

      const { token, url } = await response.json();

      // Create and connect to room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 }
        }
      });

      roomRef.current = room;

      // Set up event handlers
      room.on(RoomEvent.Connected, () => {
        console.log('Connected to room');
      });

      room.on(RoomEvent.Disconnected, (reason) => {
        console.log('Disconnected from room:', reason);
        setIsConnected(false);
        setStatus('disconnected');
        cleanup();
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connected:', participant.identity);
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          document.body.appendChild(audioElement);
          audioElementsRef.current.push(audioElement);
          console.log('Audio track subscribed from:', participant.identity);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        console.log('Track unsubscribed');
      });

      room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
        console.log('Local track published:', publication.kind);
      });

      // Connect to room
      await room.connect(url, token);
      
      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);

      setIsConnected(true);
      setIsConnecting(false);
      setStatus('connected');
      
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
      setStatus('error');
      setIsConnecting(false);
      setIsConnected(false);
    }
  };

  const disconnect = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    cleanup();
    setIsConnected(false);
    setStatus('disconnected');
  };

  const cleanup = () => {
    // Remove all audio elements
    audioElementsRef.current.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    audioElementsRef.current = [];
  };

  const toggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      cleanup();
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#4caf50';
      case 'connecting': return '#ff9800';
      case 'error': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Error';
      default: return 'Click to start';
    }
  };

  return (
    <div className={`voice-assistant-widget voice-assistant-${position}`}>
      {status === 'connected' && (
        <div 
          className="status-indicator" 
          style={{ backgroundColor: getStatusColor() }}
        />
      )}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      <button
        className={`voice-button ${isConnected ? 'active' : ''} ${isConnecting ? 'connecting' : ''}`}
        onClick={toggleConnection}
        disabled={isConnecting}
        title={getStatusText()}
        aria-label="Voice Assistant"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
      {status !== 'disconnected' && (
        <div className="status-text" style={{ color: getStatusColor() }}>
          {getStatusText()}
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;