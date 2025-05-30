'use client'

import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

interface SignUpFormProps {
  onSuccess?: () => void
  onSwitchToSignIn?: () => void
}

export function SignUpForm({ onSuccess, onSwitchToSignIn }: SignUpFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setIsLoading(true)

    try {
      await signUp(email, password)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 text-lg bg-white border border-yellow-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm transition-all"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 text-lg bg-white border border-yellow-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm transition-all"
            placeholder="Enter your password (min. 6 characters)"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-800 mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 text-lg bg-white border border-yellow-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent shadow-sm transition-all"
            placeholder="Confirm your password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Creating account...
            </div>
          ) : (
            'Create Account'
          )}
        </button>

        <div className="text-center text-sm text-gray-600">
          By signing up, you agree to our{' '}
          <button type="button" className="text-yellow-600 hover:text-yellow-700 transition-colors">
            Terms of Service
          </button>{' '}
          and{' '}
          <button type="button" className="text-yellow-600 hover:text-yellow-700 transition-colors">
            Privacy Policy
          </button>
        </div>
      </form>
    </div>
  )
} 