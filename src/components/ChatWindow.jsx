import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const CallWindow = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [selectedVoice, setSelectedVoice] = useState(null);
  const recognitionRef = useRef(null);
  const isBotSpeakingRef = useRef(false);
  const recognitionActiveRef = useRef(false);

  const initialSystemPrompt = useRef({
    role: 'system',
    content: `You are a realistic, skeptical potential client answering a cold call. You never act as the salesperson.
      Respond naturally, with objection complexity based on the difficulty level: ${difficulty}.
      Do not speak until you are called.`,
  });

  const addMessage = (sender, text) => {
    setTranscript((prev) => [...prev, { sender, text }]);
  };

  const playOpenAITTS = async (text) => {
    try {
      const voiceOptions = ['nova', 'shimmer', 'onyx', 'fable', 'echo']; // OpenAI TTS voices
      const voice = selectedVoice || voiceOptions[Math.floor(Math.random() * voiceOptions.length)];
      setSelectedVoice(voice);

      const ttsResponse = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: text,
          voice,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          },
          responseType: 'blob',
        }
      );

      const audioBlob = new Blob([ttsResponse.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      return new Promise((resolve) => {
        audio.onended = resolve;
        audio.play();
      });
    } catch (err) {
      console.error('TTS error:', err);
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
    [isCallActive, selectedVoice, playOpenAITTS]
  );

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = 'en-US';

    recog.onresult = async (event) => {
      recognitionActiveRef.current = false;
      const userText = event.results[0][0].transcript;
      addMessage('user', userText);

      const newHistory = [...chatHistory, { role: 'user', content: userText }];
      setChatHistory(newHistory);
      await handleBotReply(newHistory);
    };

    recog.onend = () => {
      recognitionActiveRef.current = false;
      if (isCallActive && !isBotSpeakingRef.current) {
        recog.start();
        recognitionActiveRef.current = true;
      }
    };

    recognitionRef.current = recog;
  }, [isCallActive, chatHistory, handleBotReply]);

  const generateFeedback = async (transcriptHistory) => {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a sales coach. Provide concise, constructive feedback on how the salesperson handled this cold call. Focus on objection handling, tone, and clarity. Give a 1–2 paragraph summary and a 1–10 score.',
            },
            {
              role: 'user',
              content: `Here's the call transcript:\n\n${transcriptHistory
                .map((msg) => `${msg.sender === 'user' ? 'Sales Rep' : 'Client'}: ${msg.text}`)
                .join('\n')}`,
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          },
        }
      );

      const coachFeedback = response.data.choices[0].message.content.trim();
      setFeedback(coachFeedback);
    } catch (error) {
      console.error('Feedback generation failed:', error);
      setFeedback('Unable to generate feedback at this time.');
    }
  };

  const playSound = (url) => {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.onended = resolve;
      audio.play();
    });
  };

  const startCall = async () => {
    setIsCallActive(true);
    setTranscript([]);
    setChatHistory([initialSystemPrompt.current]);
    setFeedback('');
    setSelectedVoice(null); // reset voice for new call

    const totalWait = Math.random() * 3000 + 2000;
    const ringSound = new Audio('/sounds/ring.mp3');
    ringSound.play();

    await new Promise((resolve) => setTimeout(resolve, totalWait));
    ringSound.pause();
    ringSound.currentTime = 0;

    const greeting = [
      'Hello?',
      "Who's this?",
      'Go for Johnny.',
      'Yeah?',
      "Hi there, who's calling?",
    ];
    const openingLine = greeting[Math.floor(Math.random() * greeting.length)];

    addMessage('bot', openingLine);
    const initialHistory = [initialSystemPrompt.current, { role: 'assistant', content: openingLine }];
    setChatHistory(initialHistory);

    await playOpenAITTS(openingLine);

    if (recognitionRef.current && !recognitionActiveRef.current) {
      recognitionRef.current.start();
      recognitionActiveRef.current = true;
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    if (recognitionRef.current) recognitionRef.current.stop();
    playSound('/sounds/disconnect.mp3');
    generateFeedback(transcript);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Cold Call Roleplay</h2>

      <div className="mb-4">
        <span className="mr-2 font-medium">Difficulty:</span>
        {['easy', 'medium', 'hard', 'god'].map((level) => (
          <button
            key={level}
            onClick={() => setDifficulty(level)}
            className={`px-3 py-1 mr-2 rounded ${
              difficulty === level ? 'bg-blue-500 text-white' : 'bg-gray-300'
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      {!isCallActive ? (
        <button
          onClick={startCall}
          className="bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600"
        >
          Call
        </button>
      ) : (
        <button
          onClick={endCall}
          className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600"
        >
          End Call
        </button>
      )}

      <div className="mt-6 bg-gray-100 p-4 rounded-xl h-64 overflow-y-scroll">
        {transcript.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 ${msg.sender === 'user' ? 'text-blue-700' : 'text-green-700'}`}
          >
            <strong>{msg.sender === 'user' ? 'You' : 'Bot'}:</strong> {msg.text}
          </div>
        ))}
      </div>

      {!isCallActive && feedback && (
        <div className="mt-6 p-4 bg-white border rounded-xl shadow">
          <h3 className="font-bold text-lg mb-2">Call Feedback</h3>
          <p>{feedback}</p>
        </div>
      )}
    </div>
  );
};

export default CallWindow;
