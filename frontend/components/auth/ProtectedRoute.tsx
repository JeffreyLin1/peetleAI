'use client'

import { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LoginForm } from './LoginForm'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {fallback || (
          <div className="max-w-md w-full space-y-8">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Authentication Required
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Please sign in to access this page
              </p>
            </div>
            <LoginForm />
          </div>
        )}
      </div>
    )
  }

  return <>{children}</>
} 