import React from 'react';

const DifficultySelector = ({ onSelect }) => {
  return (
    <div style={{ padding: '1rem' }}>
      <h3>Select Difficulty</h3>
      <button onClick={() => onSelect('easy')}>Easy</button>
      <button onClick={() => onSelect('medium')}>Medium</button>
      <button onClick={() => onSelect('hard')}>Hard</button>
      <button onClick={() => onSelect('god')}>God Mode</button>
    </div>
  );
};

export default DifficultySelector;

