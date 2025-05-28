#!/bin/bash

echo "🚀 Setting up PeetleAI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

echo "📦 Installing shared dependencies..."
cd shared && npm install && cd ..

# Create backend .env file if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating backend .env file..."
    cat > backend/.env << EOL
PORT=3001
OPENAI_API_KEY=your_openai_api_key_here
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
EOL
    echo "⚠️  Please edit backend/.env and add your OpenAI API key!"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env and add your OpenAI API key"
echo "2. Run 'npm run dev' to start both frontend and backend"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Happy coding! 🚀" 