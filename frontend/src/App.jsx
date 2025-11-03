import React from 'react';
import HomePage from './components/pages/HomePage';
import UnifiedAssistant from './components/assistant/UnifiedAssistant';

function App() {
  return (
    <div className="App" style={{ minHeight: '100vh' }}>
      <HomePage />
      <UnifiedAssistant 
        tokenServerUrl="/api/token"
        roomName="voice-assistant"
        participantName="user"
      />
    </div>
  );
}

export default App;