import React from 'react';
import HomePage from './HomePage';
import Chatbot from './Chatbot';
import VoiceAssistant from './VoiceAssistant';

function App() {
  return (
    <div className="App" style={{ minHeight: '100vh' }}>
      <HomePage />
      <Chatbot />
      <VoiceAssistant 
        tokenServerUrl="/api/token"
        roomName="voice-assistant"
        participantName="user"
        position="bottom-right"
      />
    </div>
  );
}

export default App;