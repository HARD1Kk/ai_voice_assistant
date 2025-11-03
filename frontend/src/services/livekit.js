/**
 * LiveKit connection utilities
 */

import { Room, RoomEvent, Track, RemoteParticipant, DataPacket_Kind } from 'livekit-client';

/**
 * Creates a new LiveKit room instance with default settings
 * @returns {Room} Configured LiveKit room
 */
export function createRoom() {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
  });
}

/**
 * Sets up event listeners for a LiveKit room
 * @param {Room} room - The LiveKit room instance
 * @param {Object} callbacks - Callback functions for different events
 */
export function setupRoomEventListeners(room, callbacks) {
  const {
    onDataReceived,
    onConnected,
    onDisconnected,
    onParticipantConnected,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onLocalTrackPublished,
  } = callbacks;

  // Data channel listener for transcriptions
  if (onDataReceived) {
    room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      if (kind === DataPacket_Kind.RELIABLE || kind === DataPacket_Kind.LOSSY) {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          onDataReceived(data, participant);
        } catch (e) {
          console.error('[ERROR] Error parsing data message:', e, payload);
        }
      }
    });
  }

  // Connection events
  if (onConnected) {
    room.on(RoomEvent.Connected, onConnected);
  }

  if (onDisconnected) {
    room.on(RoomEvent.Disconnected, onDisconnected);
  }

  // Participant events
  if (onParticipantConnected) {
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  }

  // Track events
  if (onTrackSubscribed) {
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
  }

  if (onTrackUnsubscribed) {
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
  }

  // Local track events
  if (onLocalTrackPublished) {
    room.localParticipant.on('trackPublished', onLocalTrackPublished);
  }
}

/**
 * Checks if a track is an audio track from microphone
 * @param {Track} track - The track to check
 * @returns {boolean} True if it's a microphone audio track
 */
export function isMicrophoneAudioTrack(track) {
  return track.kind === Track.Kind.Audio && track.source === Track.Source.SourceMicrophone;
}

/**
 * Attaches an audio track to the DOM
 * @param {Track} track - The audio track to attach
 * @returns {HTMLAudioElement} The attached audio element
 */
export function attachAudioTrack(track) {
  const audioElement = track.attach();
  audioElement.autoplay = true;
  audioElement.playsInline = true;
  document.body.appendChild(audioElement);
  return audioElement;
}

/**
 * Detaches and cleans up an audio track
 * @param {Track} track - The audio track to detach
 */
export function detachAudioTrack(track) {
  track.detach();
}
