# PeetleAI 🎬

AI-powered educational video generator with high-quality text-to-speech functionality.

## Features

- 🤖 Generate educational explanations using GPT
- 🎤 High-quality text-to-speech with ElevenLabs
- 🎨 Modern, clean UI with yellow theme
- 📱 Responsive design

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- ElevenLabs API key
- OpenAI API key

### Installation

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables:**
   
   Create a `backend/.env` file with your API keys:
   ```bash
   cd backend
   # Create .env file with:
   ELEVENLABS_API_KEY=your_actual_elevenlabs_api_key
   OPENAI_API_KEY=your_actual_openai_key
   PORT=3001
   NODE_ENV=development
   ```

### Getting API Keys

1. **ElevenLabs API Key:**
   - Go to [ElevenLabs](https://elevenlabs.io/)
   - Sign up for an account
   - Navigate to your profile settings
   - Copy your API key

2. **OpenAI API Key:**
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Sign up/login to your account
   - Go to API Keys section
   - Create a new API key

### Development

**Run both backend and frontend simultaneously:**
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend server on `http://localhost:3000`

### Individual Commands

- **Backend only:** `npm run dev:backend`
- **Frontend only:** `npm run dev:frontend`
- **Build all:** `npm run build`
- **Build backend:** `npm run build:backend`
- **Build frontend:** `npm run build:frontend`

## How to Use

1. Open `http://localhost:3000`
2. Type a question (e.g., "explain RESTful API")
3. Click "Generate Explanation"
4. Wait for GPT response
5. Click "🎤 Speak" to hear the AI-generated voice explanation!

## Project Structure

```
peetle-ai/
├── backend/          # Express.js API server
│   ├── src/
│   │   ├── routes/   # API routes
│   │   └── services/ # Business logic (OpenAI, ElevenLabs)
│   └── .env          # Environment variables
├── frontend/         # Next.js React app
│   └── app/          # App router pages
└── package.json      # Root package.json with dev scripts
```

## API Endpoints

- `POST /api/chat/generate` - Generate explanation text
- `POST /api/chat/speak` - Convert text to high-quality speech

## Technologies

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Express.js, TypeScript
- **AI Services:** OpenAI GPT, ElevenLabs Text-to-Speech
- **Fonts:** Rubik (Google Fonts)
