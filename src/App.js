import React, { useState } from 'react';
import DifficultySelector from './components/DifficultySelector';
import ChatWindow from './components/ChatWindow';

function App() {
  const [difficulty, setDifficulty] = useState(null);

  const handleDifficultySelect = (selectedDifficulty) => {
    setDifficulty(selectedDifficulty);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>Cold Call Roleplay App</h1>
      {!difficulty ? (
        <DifficultySelector onSelect={handleDifficultySelect} />
      ) : (
        <ChatWindow difficulty={difficulty} />
      )}
    </div>
  );
}

export default App;
