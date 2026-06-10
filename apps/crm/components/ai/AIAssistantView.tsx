'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChatMessage } from '@/lib/types';
import {
  Sparkles, Send, Loader2, Plus, Check, ChevronRight,
  MessageSquare, Trash2,
} from 'lucide-react';
import { relativeTime } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface Session {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface ActionData {
  type: string;
  data: Record<string, unknown>;
}

const SUGGESTED_PROMPTS = [
  "Who are my highest-value customers that haven't purchased in 60 days?",
  "Create a win-back campaign for customers who bought footwear last month",
  "Which channel gets the best engagement from my VIP customers?",
  "Draft a WhatsApp message for my Mumbai shoppers about a new collection",
  "Suggest a segment for customers likely to churn",
];

export function AIAssistantView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = async () => {
    const res = await fetch('/api/ai/chat');
    const data = await res.json();
    setSessions(data.data ?? []);
  };

  const loadSession = async (sessionId: string) => {
    setLoadingSession(true);
    setActiveSessionId(sessionId);
    const res = await fetch(`/api/ai/chat/${sessionId}`);
    const data = await res.json();
    const rawMessages = typeof data.messages === 'string' ? JSON.parse(data.messages) : data.messages;
    setMessages(rawMessages ?? []);
    setLoadingSession(false);
  };

  const newSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
  };

  const deleteSession = async (sessionId: string) => {
    await fetch(`/api/ai/chat/${sessionId}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) newSession();
  };

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    // Optimistic UI
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, message: text }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        return;
      }

      // Replace optimistic message + add assistant response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage,
        data.assistantMessage,
      ]);

      if (!activeSessionId) {
        setActiveSessionId(data.sessionId);
        fetchSessions();
      }
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAction = async (action: ActionData) => {
    if (action.type === 'create_segment' && action.data) {
      try {
        const res = await fetch('/api/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: action.data.name,
            description: action.data.description,
            filter_rules: action.data.filter_rules,
            ai_prompt: action.data.ai_prompt,
          }),
        });
        if (res.ok) {
          const seg = await res.json();
          toast({ title: 'Segment created!', description: `"${seg.name}" with ${seg.customer_count} customers` });
          router.push('/segments');
        }
      } catch {
        toast({ title: 'Failed to create segment', variant: 'destructive' });
      }
    } else if (action.type === 'create_campaign' && action.data) {
      router.push('/campaigns');
      toast({ title: 'Opening campaigns...', description: 'Use the campaign builder to finalise.' });
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sessions sidebar */}
      <aside className="w-60 border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <Button onClick={newSession} variant="outline" className="w-full gap-2 justify-start" size="sm">
            <Plus className="w-3.5 h-3.5" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">No conversations yet</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`group flex items-center justify-between px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${
                  activeSessionId === s.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{s.title ?? 'Untitled'}</p>
                  <p className="text-[10px] text-muted-foreground">{relativeTime(s.updated_at)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !loadingSession && (
            <div className="flex flex-col items-center justify-center h-full gap-6 max-w-xl mx-auto text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Hi, I&#39;m Aria</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Your AI marketing assistant. Ask me anything about your shoppers,
                  segments, or campaigns.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-left text-sm p-3 rounded-xl border hover:bg-accent hover:border-primary/30 transition-all group flex items-center justify-between"
                  >
                    <span>{p}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingSession && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} onAction={handleAction} />
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 typing-dot" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 typing-dot" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Aria about your shoppers, segments, or campaigns..."
                className="resize-none min-h-[44px] max-h-32 pr-4"
                rows={1}
              />
            </div>
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              size="icon"
              className="shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onAction,
}: {
  message: ChatMessage;
  onAction: (action: ActionData) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 chat-bubble ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-secondary' : 'bg-primary/10'
      }`}>
        {isUser ? (
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-secondary text-secondary-foreground rounded-tl-sm'
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Action card */}
        {message.action && (
          <ActionCard action={message.action as ActionData} onExecute={onAction} />
        )}

        <span className="text-[10px] text-muted-foreground">{relativeTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  onExecute,
}: {
  action: ActionData;
  onExecute: (action: ActionData) => void;
}) {
  const [done, setDone] = useState(false);

  const handleClick = () => {
    setDone(true);
    onExecute(action);
  };

  if (action.type === 'create_segment') {
    return (
      <div className="border rounded-xl p-3 bg-background max-w-sm space-y-2">
        <p className="text-xs font-medium text-muted-foreground">AI wants to create a segment</p>
        <div>
          <p className="text-sm font-semibold">{String(action.data.name ?? '')}</p>
          <p className="text-xs text-muted-foreground">{String(action.data.description ?? '')}</p>
        </div>
        <Button size="sm" onClick={handleClick} disabled={done} className="gap-2 w-full">
          {done ? <><Check className="w-3.5 h-3.5" /> Saved!</> : <><Sparkles className="w-3.5 h-3.5" /> Save Segment</>}
        </Button>
      </div>
    );
  }

  if (action.type === 'create_campaign') {
    return (
      <div className="border rounded-xl p-3 bg-background max-w-sm space-y-2">
        <p className="text-xs font-medium text-muted-foreground">AI drafted a campaign</p>
        <div>
          <p className="text-sm font-semibold">{String(action.data.name ?? '')}</p>
          <p className="text-xs text-muted-foreground italic">&ldquo;{String(action.data.message_body ?? '').slice(0, 100)}&rdquo;</p>
        </div>
        <Button size="sm" onClick={handleClick} disabled={done} variant="outline" className="gap-2 w-full">
          {done ? <><Check className="w-3.5 h-3.5" /> Opening...</> : 'Open Campaign Builder'}
        </Button>
      </div>
    );
  }

  return null;
}
