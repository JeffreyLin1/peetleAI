export const VALIDATION_RULES = {
  TOPIC: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 1000,
  },
  TEXT: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 5000,
  },
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    BASE: '/api/auth',
    ME: '/me',
    VERIFY: '/verify',
    CREATE_USER: '/create-user',
    DELETE_USER: '/delete-user',
    HEALTH: '/health',
  },
  CONTENT: {
    BASE: '/api/content',
    GENERATE: '/generate',
  },
  VIDEO: {
    BASE: '/api/video',
    GENERATE: '/generate',
    LIST: '/list',
    STREAM: '/stream',
  },
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ERROR_MESSAGES = {
  TOPIC_REQUIRED: 'Topic is required and must be a non-empty string',
  TOPIC_TOO_LONG: 'Topic is too long. Please keep it under 1000 characters.',
  TEXT_REQUIRED: 'Text is required and must be a non-empty string',
  TEXT_TOO_LONG: 'Text is too long. Please keep it under 5000 characters.',
  VIDEO_GENERATION_FAILED: 'Failed to generate video',
  CONTENT_GENERATION_FAILED: 'Failed to generate content',
  VIDEO_NOT_FOUND: 'Video not found',
  AUTHENTICATION_REQUIRED: 'Authentication required',
} as const; 