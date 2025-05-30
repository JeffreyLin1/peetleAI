import { VALIDATION_RULES, ERROR_MESSAGES } from '../config/constants';

export class ValidationError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateTopic = (topic: any): string => {
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    throw new ValidationError(ERROR_MESSAGES.TOPIC_REQUIRED);
  }

  if (topic.length > VALIDATION_RULES.TOPIC.MAX_LENGTH) {
    throw new ValidationError(ERROR_MESSAGES.TOPIC_TOO_LONG);
  }

  return topic.trim();
};

export const validateText = (text: any): string => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new ValidationError(ERROR_MESSAGES.TEXT_REQUIRED);
  }

  if (text.length > VALIDATION_RULES.TEXT.MAX_LENGTH) {
    throw new ValidationError(ERROR_MESSAGES.TEXT_TOO_LONG);
  }

  return text.trim();
};

export const validateEmail = (email: any): string => {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required and must be a string');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  return email.trim().toLowerCase();
};

export const validatePassword = (password: any): string => {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required and must be a string');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long');
  }

  return password;
}; 