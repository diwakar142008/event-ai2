"use client";

import { ArrowUp, Loader2, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

import { api, ApiError } from "@/lib/client";
import type { ChatResponse, EventPlan, EventRecord } from "@/lib/types";

type Message = { role: "user" | "assistant"; content: string; engine?: string; warnings?: string[] };

const suggestions = [
  "Where can I save money without losing the atmosphere?",
  "Build me a two-week final countdown.",
  "What should I confirm with the venue in writing?",
  "How do I make the theme feel coherent?",
];

export function AssistantPanel({ event, plan }: { event: EventRecord; plan: EventPlan | null }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: plan
        ? `I can see the saved plan for ${event.name}. Ask about budget trade-offs, the timeline, the vendor checklist, or the creative direction. I cannot check availability or make bookings.`
        : `I can help plan ${event.name}. Generate a plan first for the richest context, or ask about budget, theme, or sequencing. I cannot check availability or make bookings.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setInput("");
    setError(null);
    const next = [...messages, { role: "user" as const, content: message }];
    setMessages(next);
    setLoading(true);
    try {
      const history = next
        .filter((entry, index) => index > 0)
        .slice(-6)
        .map((entry) => ({ role: entry.role, content: entry.content.slice(0, 1500) }));
      const response = await api<ChatResponse>("/ai/chat", {
        method: "POST",
        body: { event_id: event.id, message, history: history.slice(0, -1) },
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.reply, engine: response.engine, warnings: response.warnings },
      ]);
      requestAnimationFrame(() => {
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        endRef.current?.scrollIntoView({ behavior, block: "nearest" });
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The assistant could not answer. Please retry.");
      setMessages((current) => current.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line bg-[#fbf9f3]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Grounded assistant</p>
          <h2 className="mt-0.5 font-display text-[22px]">Ask the studio</h2>
        </div>
        <span className="label-chip text-[8.5px]">
          <ShieldCheck size={11} aria-hidden /> Not saved
        </span>
      </div>

      <div
        className="max-h-[420px] space-y-4 overflow-y-auto scroll-slim p-4"
        role="log"
        aria-label="Assistant conversation"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] border border-ink bg-ink px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ivory"
                  : "max-w-[90%] border-l-2 border-burgundy bg-ivory px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-soft"
              }
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              {message.role === "assistant" && message.engine ? (
                <p className="mt-2 text-[9px] uppercase tracking-[0.1em] text-ink-mute">
                  {message.engine === "ai" ? "AI provider" : "Deterministic fallback"}
                </p>
              ) : null}
              {message.warnings?.map((warning) => (
                <p key={warning} className="mt-1.5 text-[10px] text-warn">{warning}</p>
              ))}
            </div>
          </div>
        ))}
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-ink-mute">
            <Loader2 size={13} className="animate-spin" aria-hidden /> Thinking with the saved brief…
          </div>
        ) : null}
        {error ? <p role="alert" className="text-[11.5px] text-danger">{error}</p> : null}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              disabled={loading}
              className="border border-line px-2 py-1 text-[10px] text-ink-soft transition-colors hover:border-burgundy hover:text-burgundy disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="assistant-message" className="sr-only">Message</label>
          <textarea
            id="assistant-message"
            value={input}
            onChange={(changeEvent) => setInput(changeEvent.target.value)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === "Enter" && !keyEvent.shiftKey) {
                keyEvent.preventDefault();
                send(input);
              }
            }}
            maxLength={1500}
            rows={2}
            placeholder="Ask about budget, timing, vendors, or the direction…"
            className="field-input min-h-[54px] flex-1 resize-none text-[12.5px]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex h-[46px] w-[46px] items-center justify-center bg-ink text-ivory transition-colors hover:bg-burgundy disabled:opacity-40"
          >
            <ArrowUp size={16} aria-hidden />
          </button>
        </form>
        <p className="mt-2 text-[9.5px] leading-relaxed text-ink-mute">
          Transcripts are not stored server-side. Messages and event notes are treated as untrusted data and
          validated; the assistant has no tools and cannot change records.
        </p>
      </div>
    </div>
  );
}
