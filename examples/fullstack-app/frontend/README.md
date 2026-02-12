# Seashore Full-Stack Example - Frontend

Modern React chat UI powered by `@seashore/react` with streaming responses and thread management.

## Features

- **useSeashoreChat Hook**: Seamless integration with Seashore backend
- **Real-time Streaming**: Display assistant responses as they're generated
- **Thread Management**: Switch between conversation threads
- **Clean UI**: Modern, responsive design with animations
- **Type Safety**: Full TypeScript support

## Prerequisites

- Node.js 20+
- Backend server running (see `../backend/README.md`)

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start development server:**
   ```bash
   pnpm dev
   ```

The app will start at `http://localhost:5173` with proxy to backend at port 3001.

## Architecture

```
┌─────────────────────────────────────────┐
│          React Application              │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  App.tsx                           │ │
│  │  - Thread list sidebar             │ │
│  │  - Thread creation/selection       │ │
│  │  - Welcome screen                  │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│               ▼                          │
│  ┌────────────────────────────────────┐ │
│  │  Chat.tsx                          │ │
│  │  - useSeashoreChat hook            │ │
│  │  - Message display                 │ │
│  │  - Input handling                  │ │
│  │  - Auto-scroll                     │ │
│  └────────────┬───────────────────────┘ │
└───────────────┼─────────────────────────┘
                │
                ▼ HTTP/SSE
  ┌─────────────────────────┐
  │   Backend API           │
  │   localhost:3001/api    │
  └─────────────────────────┘
```

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx           # Main app with sidebar & routing
│   ├── App.css           # App-level styles
│   ├── Chat.tsx          # Chat component with useSeashoreChat
│   ├── Chat.css          # Chat-specific styles
│   ├── index.css         # Global styles
│   └── main.tsx          # React entry point
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript config
```

## Key Components

### App.tsx

Main application shell that:
- Fetches and displays thread list
- Handles thread creation and selection
- Shows welcome screen when no thread is selected
- Manages sidebar navigation

### Chat.tsx

Chat interface that:
- Uses `useSeashoreChat` hook from `@seashore/react`
- Displays messages with user/assistant distinction
- Handles message input and submission
- Shows streaming indicator during responses
- Auto-scrolls to latest message

## useSeashoreChat Hook

The `@seashore/react` package provides a `useSeashoreChat` hook:

```typescript
const { messages, sendMessage, isStreaming, error, clearMessages } = useSeashoreChat({
  endpoint: 'http://localhost:3001/api',
  threadId: currentThreadId,
  onError: (err) => console.error(err),
})
```

**Returns:**
- `messages`: Array of chat messages with roles and content
- `sendMessage`: Function to send user message
- `isStreaming`: Boolean indicating if assistant is responding
- `error`: Error object if request fails
- `clearMessages`: Clear all messages (local only)

## Customization

### Styling

The app uses CSS variables for theming (defined in `App.css`):

```css
:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --secondary: #64748b;
  --background: #ffffff;
  --surface: #f8fafc;
  --border: #e2e8f0;
  /* ... */
}
```

Change these to customize colors.

### API Endpoint

Update the endpoint in both components:

**App.tsx:**
```typescript
const response = await fetch('YOUR_BACKEND_URL/api/threads')
```

**Chat.tsx:**
```typescript
const { ... } = useSeashoreChat({
  endpoint: 'YOUR_BACKEND_URL/api',
  // ...
})
```

Or use environment variables with Vite:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
```

### Message Formatting

Customize message display in `Chat.tsx`:

```typescript
<div className="message-content">
  {/* Add markdown rendering, code highlighting, etc. */}
  <ReactMarkdown>{message.content}</ReactMarkdown>
</div>
```

## Production Build

1. **Build the app:**
   ```bash
   pnpm build
   ```

2. **Preview production build:**
   ```bash
   pnpm preview
   ```

3. **Deploy:**

   The `dist/` folder contains static files that can be deployed to:
   - Vercel: `vercel deploy`
   - Netlify: `netlify deploy --prod --dir=dist`
   - Any static hosting (Cloudflare Pages, AWS S3, etc.)

   **Important:** Update API endpoint for production environment.

## Environment Variables

Create `.env.local` for local overrides:

```bash
VITE_API_URL=http://localhost:3001
```

Access in code:
```typescript
const API_URL = import.meta.env.VITE_API_URL
```

## Troubleshooting

**CORS errors:**
- Ensure backend CORS includes your frontend origin
- Check `backend/server.ts` cors configuration

**Streaming not working:**
- Verify SSE support in browser (all modern browsers)
- Check network tab for `text/event-stream` content type
- Ensure no middleware is buffering the response

**Messages not persisting:**
- Check `threadId` is being passed correctly
- Verify backend storage is configured
- Check backend logs for database errors

**Slow initial load:**
- Build the monorepo packages first: `pnpm build` in root
- Check that `@seashore/react` is properly linked

## Development Tips

1. **Hot Module Replacement**: Vite provides instant HMR
2. **React DevTools**: Use for debugging component state
3. **Network Tab**: Monitor SSE streams in browser DevTools
4. **TypeScript**: Run `pnpm typecheck` to catch type errors

## Responsive Design

The UI is responsive and works on:
- Desktop (1920px+)
- Tablets (768px - 1920px)
- Mobile (< 768px) - sidebar hidden on small screens

## Accessibility

- Semantic HTML elements
- ARIA labels where appropriate
- Keyboard navigation support
- Color contrast compliance

## Further Enhancements

Ideas for extending the frontend:

1. **Markdown Support**: Add `react-markdown` for rich text
2. **Code Highlighting**: Use `prism-react-renderer` for code blocks
3. **File Uploads**: Add document upload for RAG
4. **Voice Input**: Integrate Web Speech API
5. **Dark Mode**: Add theme toggle
6. **Message Actions**: Copy, edit, regenerate messages
7. **Typing Indicators**: Show when tools are being used
8. **Export**: Download conversation as PDF/Markdown
