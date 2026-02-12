# 🚀 Quick Start Guide

Get the full-stack Seashore chat application running in 5 minutes.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- OpenAI API key

## Setup Steps

### 1. Database Setup (2 minutes)

```bash
# Create database
createdb seashore

# Navigate to data package and run migrations
cd ../../packages/data
pnpm drizzle-kit push

# Return to example directory
cd ../../examples/fullstack-app
```

### 2. Environment Configuration (1 minute)

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your OpenAI API key
# DATABASE_URL=postgresql://localhost:5432/seashore
# OPENAI_API_KEY=sk-your-key-here
```

### 3. Install Dependencies (1 minute)

```bash
# Install all dependencies
pnpm install
```

### 4. Start the Application (1 minute)

```bash
# Start both backend and frontend servers
pnpm dev
```

This will start:
- **Backend** at http://localhost:3001
- **Frontend** at http://localhost:5173

### 5. Open and Test

Open your browser to **http://localhost:5173**

1. Click "New Chat" button
2. Type a message like "What is 42 * 17?"
3. Watch the streaming response!

## Try These Commands

Once running, try these example queries:

- **Math**: "What is 1234 * 5678?"
- **Time**: "What time is it in New York?"
- **Random**: "Give me a random number between 1 and 100"
- **Multiple Tools**: "Calculate 15 + 25, then give me a random number in that range"

## Troubleshooting

### Database connection error?
```bash
# Check PostgreSQL is running
pg_isready

# Verify database exists
psql -l | grep seashore
```

### Port already in use?
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill

# Kill process on port 5173
lsof -ti:5173 | xargs kill
```

### Build errors?
```bash
# Build Seashore packages first from monorepo root
cd ../..
pnpm build

# Return and try again
cd examples/fullstack-app
pnpm dev
```

## Next Steps

- **Add Tools**: Edit `backend/server.ts` to add custom tools
- **Customize UI**: Modify `frontend/src/App.css` for styling
- **Change LLM**: Update `backend/server.ts` to use different model
- **Read Docs**: See `README.md` for full documentation

## File Structure

```
fullstack-app/
├── backend/
│   └── server.ts          # ← Add tools here
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # ← Main UI
│   │   ├── Chat.tsx       # ← Chat interface
│   │   └── *.css          # ← Styling
│   └── vite.config.ts
├── .env                   # ← Your credentials
└── package.json
```

## Development Tips

### Watch logs
```bash
# Terminal 1: Backend logs
pnpm dev:backend

# Terminal 2: Frontend
pnpm dev:frontend
```

### Test API directly
```bash
# Health check
curl http://localhost:3001/health

# Test chat
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}], "stream": false}'
```

### Inspect database
```bash
psql seashore

# List threads
SELECT * FROM threads;

# View messages
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;
```

---

**That's it!** You now have a fully functional AI chat application. 

For detailed documentation, see:
- `README.md` - Full documentation
- `backend/README.md` - Backend details
- `frontend/README.md` - Frontend details
