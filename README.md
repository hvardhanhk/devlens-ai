# DevLens AI — Code Intelligence Platform

> AI-powered frontend code review with real-time streaming analysis across 5 engineering dimensions.

![DevLens AI](https://img.shields.io/badge/AI-Anthropic%20Claude-teal?style=flat-square) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) ![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite)

## Overview

DevLens is a production-grade code review tool that streams AI analysis directly into the browser. Paste any React/TypeScript code and receive expert-level feedback in real time across five analysis modes.

**Analysis Modes**
- ⚡ **Performance** — re-renders, memoization, stale closures, memory leaks
- 🔒 **Security** — XSS vectors, unsafe innerHTML, injection risks
- ♿ **Accessibility** — WCAG 2.1 AA compliance, ARIA, keyboard navigation
- ◈ **TypeScript** — type safety, implicit any, missing generics
- ⬡ **Architecture** — SOLID principles, component coupling, hook design

## Technical Highlights

| Skill | Implementation |
|---|---|
| **LLM Streaming** | Anthropic API with SSE via `ReadableStream` + `TextDecoder` |
| **State Management** | `useReducer` with typed action union — no external libs |
| **Custom Hook** | `useStreamingAnalysis` — encapsulates fetch, streaming, abort lifecycle |
| **Abort Control** | `AbortController` per request — clean cancellation on mode switch |
| **Live Parsing** | Issue severity counts extracted via regex as tokens stream in |
| **Animated Score** | SVG `strokeDashoffset` ring with `requestAnimationFrame` counter |

## Getting Started

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/devlens-ai.git
cd devlens-ai

# 2. Install
npm install

# 3. Add your Anthropic API key
echo "VITE_ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# 4. Run
npm run dev
```

> **Note:** You need an [Anthropic API key](https://console.anthropic.com). This app calls the API directly from the browser using the `anthropic-dangerous-direct-browser-access` header — suitable for demos and local dev. For production, proxy requests through a backend.

## Project Structure

```
devlens-ai/
├── src/
│   ├── App.jsx          # Main component — editor, streaming, score ring
│   └── main.jsx         # React entry point
├── index.html
├── vite.config.js
└── package.json
```

## Key Code Patterns

### Streaming LLM Response
```js
// Custom hook: useStreamingAnalysis
const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Parse SSE delta and dispatch to reducer
  dispatch({ type: "APPEND_CONTENT", payload: delta.text });
}
```

### useReducer for Predictable State
```js
case "APPEND_CONTENT": {
  const newContent = state.streamedContent + action.payload;
  const critical = (newContent.match(/\*\*\[CRITICAL\]\*\*/gi) || []).length;
  // Parse score as it streams in
  const scoreMatch = newContent.match(/SCORE:\s*(\d+)/);
  return { ...state, streamedContent: newContent, issueCount: { critical, ... }, score };
}
```

## Resume Talking Points

- *"Built a streaming LLM integration using the Anthropic Claude API with SSE parsing and AbortController for clean request lifecycle management"*
- *"Designed a multi-mode AI analysis system using useReducer for predictable state transitions — no Redux or Zustand required"*
- *"Implemented real-time issue counting and score extraction synchronized with streaming token delivery"*

## License

MIT
# devlens-ai
