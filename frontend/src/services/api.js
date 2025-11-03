/**
 * Chat API service
 */

/**
 * Send a chat message to the backend
 * @param {string} message - The user's message
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @returns {Promise<{response: string}>} The bot's response
 */
export async function sendChatMessage(message, conversationHistory = []) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get a LiveKit token for voice connection
 * @param {string} tokenServerUrl - URL to the token server
 * @param {string} roomName - Name of the LiveKit room
 * @param {string} participantName - Name of the participant
 * @returns {Promise<{token: string, url: string}>} Token and server URL
 */
export async function getLiveKitToken(tokenServerUrl, roomName, participantName) {
  const response = await fetch(
    `${tokenServerUrl}?room_name=${roomName}&participant_name=${participantName}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`);
  }

  return await response.json();
}
