'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Bot, Send, Plus, AlertCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { getSession } from '@/lib/auth';

// ─── Types ───
interface ContextSummary {
  asOf?: string;
  totals?: { total: number; open: number; closed: number; chargeSheeted: number; critical: number };
  topDistricts?: { district: string; count: number }[];
  topCategories?: { category: string; count: number }[];
  recentCases?: unknown[];
  wantedCount?: number;
  filtered?: { field: 'district' | 'category'; value: string; total: number; byStatus: { status: string; count: number }[] };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  context?: ContextSummary;
  error?: boolean;
}

// ─── Constants ───
const SESSION_KEY = 'ji_chat_session';
const SUGGESTED_QUERIES = [
  'What is the total number of cases this year?',
  'Which district has the most theft cases?',
  'Show me trends in cybercrime',
  'Who are the high-risk offenders?',
  'Analyze the conviction rate',
  'What are the crime hotspots?',
  'Summarize recent critical cases',
];

const EMPTY_CHIPS = [
  'How many cases are there?',
  'Show me crime hotspots',
  'List high-risk offenders',
  'Summarize recent critical cases',
];

// ─── Helpers ───
function makeId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ─── Markdown Renderer ───
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="font-mono text-base font-bold uppercase tracking-wider text-primary mt-3 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-primary mt-3 mb-2 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-mono text-sm font-semibold mt-3 mb-1 first:mt-0 text-foreground">
              {children}
            </h3>
          ),
          // Paragraph
          p: ({ children }) => (
            <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
          ),
          // Bold / Strong
          strong: ({ children }) => (
            <strong className="font-semibold text-primary">{children}</strong>
          ),
          // Italic / Em
          em: ({ children }) => (
            <em className="italic text-foreground/90">{children}</em>
          ),
          // Inline code
          code: ({ className, children }) => {
            const isBlock = className?.includes('language-') || String(children).includes('\n');
            if (isBlock) {
              return (
                <code className="block font-mono text-xs bg-background/60 border border-border rounded p-3 my-2 overflow-x-auto whitespace-pre">
                  {children}
                </code>
              );
            }
            return (
              <code className="font-mono text-xs bg-background/60 border border-border rounded px-1.5 py-0.5 text-primary">
                {children}
              </code>
            );
          },
          // Code block
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          // Unordered list
          ul: ({ children }) => (
            <ul className="text-sm space-y-1 mb-2 list-disc list-inside marker:text-primary/60">
              {children}
            </ul>
          ),
          // Ordered list
          ol: ({ children }) => (
            <ol className="text-sm space-y-1 mb-2 list-decimal list-inside marker:text-primary/60">
              {children}
            </ol>
          ),
          // List item
          li: ({ children }) => (
            <li className="leading-relaxed pl-1">{children}</li>
          ),
          // Horizontal rule
          hr: () => <hr className="my-3 border-border" />,
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 my-2 italic text-muted-foreground text-sm">
              {children}
            </blockquote>
          ),
          // Links
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),
          // Table
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-background/40">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-mono font-semibold text-primary">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Thinking Indicator ───
function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 max-w-[85%]"
    >
      <Avatar className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20">
        <AvatarFallback className="rounded-md bg-transparent text-primary">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono-label text-primary text-[11px]">
            JURISINTEL AI
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="flex gap-1" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" />
          </span>
          <span className="font-mono-label text-[11px] text-muted-foreground">
            ANALYZING DATABASE...
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Message Bubble ───
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-end"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
          <span className="font-mono-label text-primary text-[11px]">
            YOU
          </span>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 max-w-[80%] ml-auto">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  // Assistant
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-start max-w-[85%]"
    >
      <div className="flex items-center gap-2 mb-1">
        <Avatar className="w-5 h-5 rounded-md bg-primary/10 border border-primary/20">
          <AvatarFallback className="rounded-md bg-transparent text-primary p-0.5">
            <Bot className="w-3 h-3" />
          </AvatarFallback>
        </Avatar>
        <span className="font-mono-label text-primary text-[11px]">
          JURISINTEL AI
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatTime(message.createdAt)}
        </span>
      </div>
      <div
        className={[
          'bg-card border rounded-lg p-3 w-full',
          message.error
            ? 'border-destructive/40 bg-destructive/5'
            : 'border-border',
        ].join(' ')}
      >
        {message.error ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-xs text-destructive uppercase tracking-wider mb-1">
                CONNECTION ERROR
              </p>
              <p className="text-sm text-foreground/80">{message.content}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="font-mono text-sm">
              <MarkdownRenderer content={message.content} />
            </div>
            {message.context && (
              <details className="mt-3 group">
                <summary className="cursor-pointer list-none flex items-center gap-1.5 font-mono-label text-[10px] text-muted-foreground hover:text-foreground transition-colors select-none">
                  <Database className="w-3 h-3" />
                  <span>DATA CONTEXT USED</span>
                  <span className="ml-1 transition-transform group-open:rotate-90">›</span>
                </summary>
                <pre className="mt-2 font-mono text-[10px] leading-tight bg-background/60 border border-border rounded p-2 overflow-x-auto max-h-64 overflow-y-auto text-muted-foreground">
                  {JSON.stringify(message.context, null, 2)}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Empty State ───
function EmptyState({ onSuggestion }: { onSuggestion: (q: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex items-center justify-center p-4"
    >
      <Card className="ops-border rounded-lg p-6 md:p-8 max-w-md w-full text-center bg-card/60">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h3 className="font-mono text-xl font-bold tracking-widest text-primary mb-2">
          JURISINTEL AI
        </h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          I can analyze crime data, identify trends, profile offenders, and
          answer questions about the case database.
        </p>
        <Separator className="my-4 bg-border" />
        <p className="font-mono-label text-[11px] mb-3">SUGGESTED QUERIES</p>
        <div className="flex flex-col gap-2">
          {EMPTY_CHIPS.map((q) => (
            <button
              key={q}
              onClick={() => onSuggestion(q)}
              className="text-left text-xs font-mono px-3 py-2 rounded-md border border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              › {q}
            </button>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ───
export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Init: get username + load saved session ───
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUsername(session.username);
    }
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      setSessionId(savedSession);
    } else {
      setHistoryLoaded(true);
    }
  }, []);

  // ─── Load history when sessionId is set ───
  useEffect(() => {
    if (!sessionId || historyLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.messages?.length) return;
        setMessages(
          data.messages.map((m: { id: string; role: string; content: string; metadata?: string; createdAt: string }) => {
            let ctx: ContextSummary | undefined;
            if (m.metadata) {
              try {
                const parsed = JSON.parse(m.metadata);
                ctx = parsed?.contextSummary as ContextSummary | undefined;
              } catch {
                ctx = undefined;
              }
            }
            return {
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              createdAt: new Date(m.createdAt).getTime(),
              context: ctx,
            };
          })
        );
      } catch {
        // ignore — start fresh
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, historyLoaded]);

  // ─── Auto-scroll to bottom on new messages ───
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);

  // ─── Auto-grow textarea (up to ~4 rows) ───
  const growTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newH = Math.min(el.scrollHeight, 160); // ~4 rows
    el.style.height = `${newH}px`;
  }, []);

  useEffect(() => {
    growTextarea();
  }, [input, growTextarea]);

  // ─── Send a message ───
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            sessionId: sessionId ?? undefined,
            username: username ?? undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data?.sessionId || !data?.reply) {
          throw new Error('Invalid response shape');
        }

        // Persist session
        if (data.sessionId !== sessionId) {
          setSessionId(data.sessionId);
          localStorage.setItem(SESSION_KEY, data.sessionId);
        }

        const aiMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          content: data.reply,
          createdAt: Date.now(),
          context: data.context as ContextSummary | undefined,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const aiMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          content:
            'Unable to reach the intelligence service. Please retry the request.',
          createdAt: Date.now(),
          error: true,
        };
        setMessages((prev) => [...prev, aiMsg]);
        console.error('[AIChat] sendMessage error:', err);
      } finally {
        setLoading(false);
        // refocus input
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    },
    [loading, sessionId, username]
  );

  // ─── New session ───
  const handleNewSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(SESSION_KEY);
    setInput('');
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  // ─── Keydown handler ───
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] md:h-[calc(100vh-9.5rem)] min-h-[420px] gap-3">
      {/* ─── Header ─── */}
      <SectionHeader
        title="AI INTELLIGENCE ASSISTANT"
        subtitle="JURISINTEL // Natural Language Query Interface"
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="font-mono text-[10px] h-6 border-ops-emerald/40 text-ops-emerald gap-1.5 px-2"
            >
              <span className="pulse-dot emerald" />
              LLM: ONLINE
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
              className="font-mono text-[11px] uppercase tracking-wider h-7"
            >
              <Plus className="w-3.5 h-3.5" />
              New SESSION
            </Button>
          </div>
        }
      />

      {/* ─── Body: sidebar + chat ─── */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* Sidebar — md+ only */}
        <aside className="hidden md:flex flex-col w-64 flex-shrink-0">
          <Card className="ops-border rounded-lg bg-card/40 flex flex-col flex-1 min-h-0">
            <div className="px-3 py-3 border-b border-border">
              <p className="font-mono-label text-[11px] text-muted-foreground">
                SUGGESTED QUERIES
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="w-full text-left text-xs font-mono px-2.5 py-2 rounded-md border border-transparent hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  › {q}
                </button>
              ))}
            </div>
            <Separator className="bg-border" />
            <div className="p-3">
              <div className="flex items-center gap-2">
                <span className="pulse-dot emerald" />
                <span className="font-mono-label text-[10px] text-ops-emerald">
                  DB LINK ACTIVE
                </span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-2 leading-relaxed">
                Queries are enriched with live data from the case database.
              </p>
            </div>
          </Card>
        </aside>

        {/* Chat panel */}
        <div className="flex-1 min-h-0 flex flex-col ops-border rounded-lg bg-card/30 overflow-hidden">
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {!historyLoaded ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2">
                  <span className="pulse-dot emerald" />
                  <span className="font-mono-label text-[11px] text-muted-foreground">
                    LOADING SESSION...
                  </span>
                </div>
              </div>
            ) : !hasMessages ? (
              <EmptyState onSuggestion={(q) => sendMessage(q)} />
            ) : (
              <>
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                <AnimatePresence>
                  {loading && <ThinkingIndicator key="thinking" />}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Input area — sticky bottom */}
          <div className="border-t border-border bg-card/60 p-3 md:p-4 flex-shrink-0">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Query the intelligence database... e.g. 'How many murder cases in Bengaluru?'"
                rows={1}
                disabled={loading}
                aria-label="Message input"
                className="font-mono text-sm resize-none bg-background/60 min-h-[44px] max-h-40 flex-1"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-4 font-mono uppercase tracking-wider text-xs"
                aria-label="Send message"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    <span className="hidden sm:inline">Sending</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="font-mono text-[10px] text-muted-foreground">
                <kbd className="px-1 py-0.5 border border-border rounded bg-background/40">Enter</kbd> to send ·{' '}
                <kbd className="px-1 py-0.5 border border-border rounded bg-background/40">Shift+Enter</kbd> for newline
              </p>
              {sessionId && (
                <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[40%]">
                  SESSION: {sessionId.slice(0, 8)}…
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
