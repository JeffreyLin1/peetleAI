'use client';

import { useState, useRef } from 'react';
import { api } from '../lib/api';

interface ImageUploadProps {
  placeholder: string;
  onImageUploaded: (placeholder: string, imagePath: string) => void;
  onImageRemoved: (placeholder: string) => void;
  uploadedImagePath?: string;
}

export function ImageUpload({ placeholder, onImageUploaded, onImageRemoved, uploadedImagePath }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const response = await api.images.upload(file, placeholder);
      
      if (response.success && response.data) {
        onImageUploaded(placeholder, response.data.imagePath);
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async () => {
    if (!uploadedImagePath) return;

    try {
      await api.images.delete(uploadedImagePath);
      onImageRemoved(placeholder);
    } catch (err) {
      console.error('Image deletion error:', err);
      setError('Failed to remove image');
    }
  };

  const getImageUrl = (imagePath: string) => {
    // Convert file path to URL path
    const relativePath = imagePath.replace('public/', '');
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/${relativePath}`;
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
      <div className="mb-2">
        <span className="text-sm font-medium text-gray-700">
          Upload image for: <span className="text-blue-600">{placeholder}</span>
        </span>
      </div>

      {uploadedImagePath ? (
        <div className="space-y-3">
          <div className="relative inline-block">
            <img
              src={getImageUrl(uploadedImagePath)}
              alt={placeholder}
              className="max-w-32 max-h-32 object-cover rounded-lg border"
            />
          </div>
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              onClick={handleRemoveImage}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm">Click to upload an image</p>
            <p className="text-xs text-gray-400">JPG, PNG, GIF, WebP up to 10MB</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Choose Image'}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
} 