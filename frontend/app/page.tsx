'use client';

import { useState } from 'react';

interface ChatResponse {
  message: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface SpeechResponse {
  audioUrl: string;
  provider: string;
}

export default function Home() {
  const [topic, setTopic] = useState('');
  const [response, setResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');
    setAudioUrl('');

    try {
      const res = await fetch('http://localhost:3001/api/chat/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic: topic.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate response');
      }

      if (data.success && data.data) {
        setResponse(data.data.message);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error generating response:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSpeech = async () => {
    if (!response.trim()) return;

    setIsSpeechLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:3001/api/chat/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: response.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate speech');
      }

      if (data.success && data.data) {
        // Construct the full URL for the audio file
        const fullAudioUrl = `http://localhost:3001${data.data.audioUrl}`;
        setAudioUrl(fullAudioUrl);
        console.log('Audio file ready:', fullAudioUrl);
      } else {
        throw new Error('Invalid speech response format');
      }
    } catch (err) {
      console.error('Error generating speech:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSpeechLoading(false);
    }
  };

  const handleReset = () => {
    setTopic('');
    setResponse('');
    setError('');
    setAudioUrl('');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Dot pattern background */}
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23374151' fill-opacity='0.4'%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 font-[var(--font-rubik)]">
            <span className="text-yellow-400">
              Peetle
            </span>
            <span className="text-gray-900">AI</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-700 mb-4 max-w-3xl mx-auto font-[var(--font-rubik)]">
            Generate engaging videos with Subway Surfers gameplay and Peter & Stewie Griffin explanations
          </p>
        </div>

        {/* Main Input Section */}
        <div className="w-full max-w-4xl mx-auto">
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-yellow-200/60">
            <div className="space-y-6">
              <div>
                <label htmlFor="topic" className="block text-lg font-medium text-gray-800 mb-3">
                  What would you like to explain?
                </label>
                <textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a topic or question... (e.g., 'How does photosynthesis work?' or 'Explain quantum physics')"
                  className="w-full px-4 py-4 text-lg bg-white border border-yellow-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none shadow-sm"
                  rows={4}
                  disabled={isLoading || isSpeechLoading}
                />
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={handleGenerate}
                  disabled={!topic.trim() || isLoading || isSpeechLoading}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                      Generating...
                    </div>
                  ) : topic.trim() ? 'Generate Explanation' : 'Enter a topic to continue'}
                </button>
                
                {response && (
                  <button
                    onClick={handleGenerateSpeech}
                    disabled={isSpeechLoading || isLoading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                  >
                    {isSpeechLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                        Generating...
                      </div>
                    ) : '🎤 Speak'}
                  </button>
                )}
                
                {(response || error) && (
                  <button
                    onClick={handleReset}
                    disabled={isLoading || isSpeechLoading}
                    className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-xl text-lg transition-all duration-200"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-center">{error}</p>
                </div>
              )}

              {/* Response Display */}
              {response && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="text-yellow-600">
                      AI Explanation:
                    </span>
                  </h3>
                  <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {response}
                  </div>
                  
                  {/* Audio Player */}
                  {audioUrl && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-blue-700 font-medium">🎵 Audio Generated!</p>
                        <a 
                          href={audioUrl} 
                          download 
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          📥 Download MP3
                        </a>
                      </div>
                      <audio controls className="w-full">
                        <source src={audioUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
