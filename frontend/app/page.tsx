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

export default function Home() {
  const [topic, setTopic] = useState('');
  const [response, setResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');

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

  const handleReset = () => {
    setTopic('');
    setResponse('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Peetle
            </span>
            <span className="text-white">AI</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto">
            Generate engaging videos with Subway Surfers gameplay and Peter & Stewie Griffin explanations
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Transform any topic into an entertaining video that keeps viewers engaged while they learn
          </p>
        </div>

        {/* Main Input Section */}
        <div className="w-full max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
            <div className="space-y-6">
              <div>
                <label htmlFor="topic" className="block text-lg font-medium text-white mb-3">
                  What would you like to explain?
                </label>
                <textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a topic or question... (e.g., 'How does photosynthesis work?' or 'Explain quantum physics')"
                  className="w-full px-4 py-4 text-lg bg-white/20 border border-white/30 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none backdrop-blur-sm"
                  rows={4}
                  disabled={isLoading}
                />
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={handleGenerate}
                  disabled={!topic.trim() || isLoading}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                      Generating...
                    </div>
                  ) : topic.trim() ? 'Generate Explanation' : 'Enter a topic to continue'}
                </button>
                
                {(response || error) && (
                  <button
                    onClick={handleReset}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-4 px-6 rounded-xl text-lg transition-all duration-200"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-200 text-center">{error}</p>
                </div>
              )}

              {/* Response Display */}
              {response && (
                <div className="bg-white/20 border border-white/30 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Peter Griffin explains:
                    </span>
                  </h3>
                  <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {response}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Features Preview - Only show when no response */}
        {!response && !error && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">AI-Powered Explanations</h3>
              <p className="text-gray-300">Peter & Stewie Griffin break down complex topics in an entertaining way</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Engaging Backgrounds</h3>
              <p className="text-gray-300">Subway Surfers or Minecraft Parkour gameplay keeps viewers hooked</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Instant Generation</h3>
              <p className="text-gray-300">Get your educational video in minutes, not hours</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
