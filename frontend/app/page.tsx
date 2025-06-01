'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { AuthModal } from '../components/auth/AuthModal';
import { ImageUpload } from '../components/ImageUpload';

// Get the API base URL from environment or fallback to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ContentResponse {
  message: string;
  dialogue?: DialogueLine[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DialogueLine {
  speaker: 'Peter' | 'Stewie';
  text: string;
  imagePlaceholder?: string;
}

interface VideoResponse {
  videoUrl: string;
  provider: string;
}

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [topic, setTopic] = useState('');
  const [dialogue, setDialogue] = useState<DialogueLine[]>([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [error, setError] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [fallbackVideoUrl, setFallbackVideoUrl] = useState<string>('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{ [placeholder: string]: string }>({});
  const [currentStep, setCurrentStep] = useState<'input' | 'script' | 'images' | 'video'>('input');

  // Get unique placeholders from dialogue
  const uniquePlaceholders = dialogue.reduce((acc, line) => {
    if (line.imagePlaceholder && !acc.includes(line.imagePlaceholder)) {
      acc.push(line.imagePlaceholder);
    }
    return acc;
  }, [] as string[]);

  // Track elapsed time during video generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isGeneratingVideo && startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(elapsed);
        
        // Estimate remaining time (rough estimate: 30-60 seconds total)
        const estimatedTotal = 45; // seconds
        const remaining = Math.max(0, estimatedTotal - elapsed);
        setEstimatedTimeRemaining(remaining);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGeneratingVideo, startTime]);

  const handleGenerateScript = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!topic.trim()) return;

    setIsGeneratingScript(true);
    setError('');
    setDialogue([]);
    setUploadedImages({});
    setCurrentStep('input');

    try {
      // Generate dialogue content using the content API
      const contentData = await api.content.generate(topic.trim());

      if (!contentData.success || !contentData.data) {
        throw new Error('Invalid response format');
      }

      const dialogueData = contentData.data.dialogue || [];
      setDialogue(dialogueData);
      
      // Skip script review and go directly to image upload or video generation
      const uniquePlaceholders = dialogueData.reduce((acc: string[], line: DialogueLine) => {
        if (line.imagePlaceholder && !acc.includes(line.imagePlaceholder)) {
          acc.push(line.imagePlaceholder);
        }
        return acc;
      }, [] as string[]);

      if (uniquePlaceholders.length > 0) {
        setCurrentStep('images');
      } else {
        // No placeholders, go directly to video generation
        setCurrentStep('video');
        handleGenerateVideo();
      }
    } catch (err) {
      console.error('Error generating script:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateVideo = async () => {
    setIsGeneratingVideo(true);
    setError('');
    setVideoUrl('');
    setFallbackVideoUrl('');
    setStartTime(Date.now());
    setElapsedTime(0);
    setEstimatedTimeRemaining(55);
    setCurrentStep('video');

    try {
      // Generate video using the video API with dialogue and uploaded images
      const videoData = await api.video.generate(dialogue, uploadedImages);

      if (videoData.success && videoData.data) {
        // Use the video URL directly from the response
        const videoUrl = videoData.data.videoUrl;
        
        // Check if it's a cloud storage URL (starts with http) or local path
        if (videoUrl.startsWith('http')) {
          // Cloud storage URL - use directly
          setVideoUrl(videoUrl);
          setFallbackVideoUrl(videoUrl);
        } else {
          // Local path - construct full URLs
          const fullVideoUrl = `${API_BASE_URL}${videoUrl}`;
          const filename = videoUrl.split('/').pop();
          const streamVideoUrl = api.video.stream(filename || '');
          
          setVideoUrl(fullVideoUrl);
          setFallbackVideoUrl(streamVideoUrl);
        }
      } else {
        throw new Error('Invalid video response format');
      }
    } catch (err) {
      console.error('Error generating video:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleImageUploaded = (placeholder: string, imagePath: string) => {
    setUploadedImages(prev => ({
      ...prev,
      [placeholder]: imagePath
    }));
  };

  const handleImageRemoved = (placeholder: string) => {
    setUploadedImages(prev => {
      const newImages = { ...prev };
      delete newImages[placeholder];
      return newImages;
    });
  };

  const handleReset = () => {
    setTopic('');
    setDialogue([]);
    setError('');
    setVideoUrl('');
    setFallbackVideoUrl('');
    setStartTime(null);
    setElapsedTime(0);
    setEstimatedTimeRemaining(null);
    setUploadedImages({});
    setCurrentStep('input');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      handleReset(); // Clear any generated content
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Dot pattern background - fixed to always cover viewport */}
      <div className="fixed inset-0 opacity-40 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23374151' fill-opacity='0.4'%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      <div className="relative z-10 px-4 sm:px-6 lg:px-8">
        {/* Header with user info */}
        {user && (
          <div className="flex justify-end pt-4">
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center pt-16 pb-8">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 font-[var(--font-rubik)]">
            <span className="text-yellow-400">
              Peetle
            </span>
            <span className="text-gray-900">AI</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-700 mb-4 max-w-3xl mx-auto font-[var(--font-rubik)]">
            Generate engaging videos with Peter & Stewie Griffin explanations
          </p>
          {!user && (
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Sign in to start generating your personalized educational videos
            </p>
          )}
        </div>

        {/* Input Section */}
        <div className="w-full max-w-4xl mx-auto mb-8">
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-yellow-200/60">
            <div className="space-y-6">
              <div>
                <label htmlFor="topic" className="block text-lg font-medium text-gray-800 mb-3">
                  What would you like Peter and Stewie to explain?
                </label>
                <textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={user ? "Enter a topic or question... (e.g., 'How does photosynthesis work?' or 'Explain quantum physics')" : "Sign in to start generating videos..."}
                  className="w-full px-4 py-4 text-lg bg-white border border-yellow-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none shadow-sm"
                  rows={4}
                  disabled={isGeneratingScript || isGeneratingVideo || !user}
                />
              </div>
              
              <div className="flex gap-4">
                {!isGeneratingScript && !isGeneratingVideo && (
                  <button
                    onClick={handleGenerateScript}
                    disabled={user ? !topic.trim() : false}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                  >
                    {!user 
                      ? 'Log In to Generate Videos' 
                      : topic.trim() 
                        ? 'Generate Script & Upload Images' 
                        : 'Enter a topic to continue'
                    }
                  </button>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-center">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dialogue Display Section - REMOVED since we skip script review */}

        {/* Image Upload Section */}
        {currentStep === 'images' && uniquePlaceholders.length > 0 && user && (
          <div className="w-full max-w-4xl mx-auto mb-8">
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-purple-200/60">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Upload Images for Placeholders
                </h2>
                <p className="text-gray-600">
                  Upload images for each placeholder to replace them in the video, or skip to use text placeholders
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {uniquePlaceholders.map((placeholder) => (
                  <ImageUpload
                    key={placeholder}
                    placeholder={placeholder}
                    onImageUploaded={handleImageUploaded}
                    onImageRemoved={handleImageRemoved}
                    uploadedImagePath={uploadedImages[placeholder]}
                  />
                ))}
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleGenerateVideo}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Generate Video
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Section - Separate from input */}
        {(isGeneratingVideo || videoUrl) && user && (
          <div className="w-full max-w-4xl mx-auto pb-16">
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-blue-200/60">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {isGeneratingVideo ? 'Generating Your Video...' : 'Your Generated Video'}
                </h2>
                <p className="text-gray-600">
                  {isGeneratingVideo ? 'Please wait while we create your Peter & Stewie explanation video!' : 'Here\'s your Peter & Stewie explanation video!'}
                </p>
              </div>
              
              {isGeneratingVideo ? (
                <div className="flex flex-col items-center space-y-6">
                  {/* Progress Animation */}
                  <div className="relative">
                    <div className="w-32 h-32 border-8 border-yellow-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-32 h-32 border-8 border-yellow-500 rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  
                  {/* Progress Information */}
                  <div className="text-center space-y-2">
                    <div className="text-lg font-semibold text-gray-800">
                      Time Elapsed: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                    </div>
                    {estimatedTimeRemaining !== null && (
                      <div className="text-md text-gray-600">
                        Estimated Time Remaining: {Math.floor(estimatedTimeRemaining / 60)}:{(estimatedTimeRemaining % 60).toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <video 
                    key={videoUrl}
                    controls 
                    className="max-w-sm w-full rounded-lg shadow-lg"
                    style={{ aspectRatio: '9/16' }}
                    preload="metadata"
                    onError={(e) => {
                      const target = e.target as HTMLVideoElement;
                      const error = target.error;
                      console.error('Video playback error details:', {
                        code: error?.code,
                        message: error?.message,
                        networkState: target.networkState,
                        readyState: target.readyState,
                        src: target.src
                      });
                      
                      if (fallbackVideoUrl && target.src !== fallbackVideoUrl) {
                        console.log('Trying fallback URL:', fallbackVideoUrl);
                        target.src = fallbackVideoUrl;
                        target.load();
                      } else {
                        setError(`Video playback failed. Error code: ${error?.code}. Please try the direct link or download.`);
                      }
                    }}
                    onLoadStart={() => console.log('Video load started')}
                    onLoadedMetadata={() => console.log('Video metadata loaded')}
                    onCanPlay={() => console.log('Video can play')}
                    onLoadedData={() => console.log('Video data loaded')}
                  >
                    <source src={videoUrl} type="video/mp4" />
                    <p>Your browser does not support the video element. Please use the direct link or download the video file.</p>
                  </video>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signin"
      />
    </div>
  );
} 