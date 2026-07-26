# Task 3 — AI Chat View (KILLER FEATURE)

**Task ID:** 3
**Agent:** frontend-aichat
**Task:** Build `src/components/jurisintel/views/AIChat.tsx` — a real LLM-powered intelligence-assistant chat interface

## File Delivered
- `src/components/jurisintel/views/AIChat.tsx` (~674 lines, `'use client'`, named export `AIChat`)

## Architecture

### Layout (flex column, fills Layout main area without double scrollbars)
- Root: `flex flex-col h-[calc(100vh-8.5rem)] md:h-[calc(100vh-9.5rem)] min-h-[420px] gap-3`
- Header row: `SectionHeader` (title/subtitle) + right-side action group (`LLM: ONLINE` badge w/ pulse dot + `NEW SESSION` button).
- Body: `flex-1 min-h-0 flex gap-3` → left sidebar (`hidden md:flex w-64`) + chat panel (`flex-1 min-h-0 flex flex-col`).

### Sub-components
1. **`MarkdownRenderer`** — wraps `react-markdown` (already in deps, v10.1.0) with a custom component map:
   - h1/h2/h3 styled amber/uppercase for ops feel
   - p, strong (amber), em, ul/ol/li (amber markers), hr, blockquote (amber left border)
   - code (inline: amber pill; block: dark bordered pre)
   - a (opens in new tab), table/thead/th/td (bordered)
2. **`ThinkingIndicator`** — animated 3-dot bounce + "ANALYZING DATABASE..." label inside a JURISINTEL AI card. Wrapped in `AnimatePresence`.
3. **`MessageBubble`** — renders user vs assistant differently:
   - User: right-aligned, `bg-primary/10 border-primary/20 rounded-lg p-3 max-w-[80%] ml-auto`, "YOU" label + mono timestamp above.
   - Assistant: left-aligned card with Bot avatar, "JURISINTEL AI" label, timestamp, markdown body, and collapsible "DATA CONTEXT USED" `<details>` showing the JSON context.
   - Error variant: destructive-tinted card with AlertCircle + "CONNECTION ERROR" heading.
4. **`EmptyState`** — centered Card with Bot icon tile, "JURISINTEL AI" title, marketing copy, separator, and 4 clickable suggestion chips.

### State & Behavior
- State: `messages: ChatMessage[]`, `input`, `sessionId`, `loading`, `username`, `historyLoaded`.
- Refs: `scrollRef` (messages div for auto-scroll), `textareaRef` (input for focus + auto-grow).
- On mount: read username from `getSession()`; read `ji_chat_session` from localStorage. If present, fetch `/api/chat/history?sessionId=X` and hydrate messages (parsing `metadata.contextSummary` for the collapsible context).
- `sendMessage(text)`: optimistic user-msg append → POST `/api/chat/send` → on success persist new sessionId + append assistant reply with context; on failure append destructive error bubble. Always re-focuses textarea + auto-scrolls.
- `handleNewSession`: clears messages, drops localStorage sessionId, refocuses.
- Enter to send, Shift+Enter for newline (handled in `onKeyDown`).
- Auto-grow textarea: effect sets `el.style.height = 'auto'` then `min(scrollHeight, 160px)` (~4 rows cap).

### Styling Notes
- All shadcn primitives (Button, Textarea, Badge, Card, Separator, Avatar).
- Dark ops-center theme: amber/gold primary, dark zinc bg, emerald (LLM: ONLINE) + red (error) accents. **No indigo/blue.**
- Custom classes from globals.css reused: `pulse-dot emerald`, `font-mono-label`, `ops-border`.
- Timestamps: `font-mono text-[10px] text-muted-foreground`.
- User bubble spec exact: `bg-primary/10 border border-primary/20 rounded-lg p-3 max-w-[80%] ml-auto`.
- Assistant bubble spec exact: `bg-card border border-border rounded-lg p-3 max-w-[85%]` + small JURISINTEL AI label + Bot icon at top.
- Framer Motion: messages fade + slide up on mount.

## Verification

### Lint
- `bun run lint` → 0 errors / 0 warnings.
- Fixed: removed an initial `void User;` placeholder (caused `ReferenceError: User is not defined` at module load) and a redundant `eslint-disable-next-line no-console` directive.

### End-to-end browser test (agent-browser)
1. Opened `http://localhost:3000/` → login screen.
2. Filled `admin` / `ChangeMe@2026` → clicked AUTHENTICATE → dashboard rendered.
3. Clicked "AI CHAT" in sidebar → empty-state welcome card + sidebar of 7 suggested queries + LLM: ONLINE badge + NEW SESSION button all visible.
4. Typed "How many cases are there?" in the textarea → Send button enabled → clicked.
5. "ANALYZING DATABASE..." thinking indicator appeared.
6. ~1.3s later the LLM replied with rich markdown:
   > As of July 26, 2026, there are **150 total cases** in the Karnataka State Police crime dashboard.
   > - **Open cases**: 29
   > - **Closed cases**: 64
   > - **Charge-sheeted cases**: 35
   > - **Critical cases**: 26
   > - **Wanted individuals**: 17
   A "DATA CONTEXT USED" disclosure triangle was rendered below the reply.
7. Server log confirmed `POST /api/chat/send 200 in 1281ms` with the full Prisma query trace (totals, district/category detection, recent cases, etc.) and both ChatMessage INSERTs.
8. Clicked "NEW SESSION" → messages cleared, welcome card reappeared.
9. Clicked a sidebar suggestion ("What is the total number of cases this year?") → auto-sent → received a markdown reply with bold "Total Cases This Year" heading and **150** in bold.
10. No browser console errors. No page errors. Screenshot saved to `/tmp/aichat-test.png`.

## Implementation Notes
- `react-markdown` is in `package.json` so no custom regex parser was needed — used the library directly with a fully-custom component map.
- The chat panel uses `flex-1 min-h-0` on both the outer body and the messages region so the messages area scrolls internally without triggering the parent `<main>` scrollbar.
- The textarea auto-grow is capped at 160px (~4 rows) per spec.
- Sessions persist across reloads via `localStorage['ji_chat_session']` and are rehydrated from `/api/chat/history`.
- Username is passed to `/api/chat/send` so the backend can resolve the user (matches the seeded `admin` user).
- The thinking indicator + send button spinner both use Tailwind's `animate-bounce` / `animate-spin` (no extra deps).
- Errors are surfaced as a destructive-tinted assistant bubble saying "Unable to reach the intelligence service. Please retry the request." (the spec's "CONNECTION ERROR — retry" intent).

## Stage Summary
The AI Chat KILLER FEATURE is fully shipped, lint-clean, and verified end-to-end against the real z-ai-web-dev-sdk LLM. The view fills the content area without double scrollbars, renders rich markdown, shows the thinking indicator, persists sessions to localStorage, hydrates history on reload, supports the suggested-query sidebar + empty-state chips, includes the transparent "DATA CONTEXT USED" disclosure, handles errors gracefully, and is fully responsive + keyboard accessible.
