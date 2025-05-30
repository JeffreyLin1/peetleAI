'use client'

import { useState, useEffect } from 'react'
import { LoginForm } from './LoginForm'
import { SignUpForm } from './SignUpForm'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultMode?: 'signin' | 'signup'
}

export function AuthModal({ isOpen, onClose, defaultMode = 'signin' }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode)
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Small delay to trigger the animation after the component is rendered
      setTimeout(() => setIsAnimating(true), 10)
    } else {
      setIsAnimating(false)
      // Wait for animation to complete before hiding
      setTimeout(() => setIsVisible(false), 200)
    }
  }, [isOpen])

  if (!isVisible) return null

  const handleSuccess = () => {
    console.log('Auth success, closing modal')
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop with fade animation */}
      <div 
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-200 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23374151' fill-opacity='0.2'%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/svg%3E")`
        }} 
      />
      
      <div 
        className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
        onClick={handleBackdropClick}
      >
        {/* Modal panel with scale and fade animation */}
        <div className={`inline-block align-bottom bg-white/95 backdrop-blur-lg rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all duration-200 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10 border border-yellow-200/60 ${
          isAnimating 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}>
          <div className="bg-white/90 backdrop-blur-lg px-6 pt-6 pb-6 sm:p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="text-center flex-1">
                <h3 className="text-2xl font-bold text-gray-900 font-[var(--font-rubik)]">
                  <span className="text-yellow-500">Peetle</span>
                  <span className="text-gray-900">AI</span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {mode === 'signin' ? 'Welcome back!' : 'Join the community!'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mode Toggle with smooth transition */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => setMode('signin')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === 'signin'
                    ? 'bg-yellow-500 text-white shadow-sm transform scale-105'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === 'signup'
                    ? 'bg-yellow-500 text-white shadow-sm transform scale-105'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form Content with fade transition */}
            <div className={`space-y-6 transition-opacity duration-150 ${
              isAnimating ? 'opacity-100' : 'opacity-0'
            }`}>
              {mode === 'signin' ? (
                <LoginForm
                  onSuccess={handleSuccess}
                  onSwitchToSignUp={() => setMode('signup')}
                />
              ) : (
                <SignUpForm
                  onSuccess={handleSuccess}
                  onSwitchToSignIn={() => setMode('signin')}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 