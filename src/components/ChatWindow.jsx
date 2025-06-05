import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [isCallActive, setIsCallActive] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const recognitionRef = useRef(null);
  const recognitionActiveRef = useRef(false);
  const isBotSpeakingRef = useRef(false);
  const initialSystemPrompt = useRef({
    role: 'system',
    content: 'You are a grumpy manager being cold-called by a new salesperson. Respond as realistically as possible, and hang up if they annoy you.',
  });

  const setChatHistory = (history) => {
    // Update your state for chat history or other logic here
  };

  const addMessage = (sender, content) => {
    setMessages((prev) => [...prev, { sender, content }]);
  };

  const playOpenAITTS = async (text) => {
    if (!selectedVoice) return;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          voice: selectedVoice,
          input: text,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          responseType: 'blob',
        }
      );

      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (error) {
      console.error('TTS playback error:', error);
    }
  };

  const handleBotReply = useCallback(
    async (updatedHistory) => {
      isBotSpeakingRef.current = true;

      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo',
            messages: [initialSystemPrompt.current, ...updatedHistory],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
            },
          }
        );

        const replyText = response.data.choices[0].message.content.trim();
        addMessage('bot', replyText);
        const newHistory = [...updatedHistory, { role: 'assistant', content: replyText }];
        setChatHistory(newHistory);

        await playOpenAITTS(replyText);
        isBotSpeakingRef.current = false;

        if (isCallActive && recognitionRef.current && !recognitionActiveRef.current) {
          recognitionRef.current.start();
          recognitionActiveRef.current = true;
        }
      } catch (error) {
        console.error('OpenAI API error:', error);
        const fallback = "Sorry, I couldn't think of a reply.";
        addMessage('bot', fallback);
        setChatHistory([...updatedHistory, { role: 'assistant', content: fallback }]);
        isBotSpeakingRef.current = false;
      }
    },
    [isCallActive] // ✅ Only necessary dependency
  );

  // Add your voice input and other handlers here

  return (
    <div className="chat-window">
      {/* Render messages */}
      {messages.map((msg, index) => (
        <div key={index} className={`message ${msg.sender}`}>{msg.content}</div>
      ))}
      {/* Add input field, start/end call buttons, etc. */}
    </div>
  );
};

export default ChatWindow;
