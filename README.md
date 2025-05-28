# PeetleAI

A platform for generating engaging educational videos with Subway Surfers gameplay backgrounds and Peter & Stewie Griffin explanations.

## Project Structure

This is a monorepo containing:

- `frontend/` - Next.js React application with TypeScript and Tailwind CSS
- `backend/` - Express.js API server with OpenAI integration
- `shared/` - Shared types and utilities (future use)

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### 2. Backend Setup

```bash
cd backend
```

Create a `.env` file in the backend directory:

```env
PORT=3001
OPENAI_API_KEY=your_openai_api_key_here
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

**Important:** Replace `your_openai_api_key_here` with your actual OpenAI API key.

### 3. Frontend Setup

The frontend is already configured to connect to the backend at `http://localhost:3001`.

## Running the Application

### Development Mode

From the root directory:

```bash
# Start both frontend and backend concurrently
npm run dev
```

This will start:
- Frontend at `http://localhost:3000`
- Backend at `http://localhost:3001`

### Individual Services

```bash
# Frontend only
npm run dev:frontend

# Backend only  
npm run dev:backend
```

## API Endpoints

### Backend API

- `GET /health` - Health check endpoint
- `POST /api/chat/generate` - Generate explanation for a topic

Example request:
```bash
curl -X POST http://localhost:3001/api/chat/generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "How does photosynthesis work?"}'
```

## Features

### Current Implementation

- ✅ Modern, responsive landing page
- ✅ Topic input with validation
- ✅ OpenAI-powered explanations in Peter Griffin's style
- ✅ Loading states and error handling
- ✅ Monorepo structure with workspace management

### Future Features

- 🔄 Video generation with Subway Surfers/Minecraft backgrounds
- 🔄 Stewie Griffin character integration
- 🔄 Video export and sharing
- 🔄 User authentication and history
- 🔄 Advanced video customization options

## Technology Stack

### Frontend
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4

### Backend
- Express.js
- TypeScript
- OpenAI API
- CORS & Helmet for security

## Development

### Project Scripts

```bash
# Development
npm run dev                 # Start both services
npm run dev:frontend       # Frontend only
npm run dev:backend        # Backend only

# Building
npm run build              # Build both services
npm run build:frontend     # Frontend only
npm run build:backend      # Backend only

# Installation
npm run install:all        # Install all dependencies
```

### Environment Variables

#### Backend (.env)
- `PORT` - Backend server port (default: 3001)
- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3000)
- `NODE_ENV` - Environment (development/production)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and proprietary.
