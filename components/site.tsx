"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  generateId,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SiteUIMessage } from "@/lib/agent";
import { MAX_USER_MESSAGES } from "@/lib/limits";
import type { Starter } from "@/lib/starters";

type SiteProps = { starters: Starter[] };

function makeMessage(role: "user" | "assistant", text: string): SiteUIMessage {
  return {
    id: generateId(),
    role,
    parts: [{ type: "text", text }],
  };
}

const chatTransport = new DefaultChatTransport<SiteUIMessage>({
  api: "/api/chat",
  fetch: async (input, init) => {
    const res = await fetch(input, init);
    if (!res.ok) {
      let serverMessage = "";
      try {
        const body = (await res.clone().json()) as { error?: string };
        if (typeof body?.error === "string" && body.error.trim()) {
          serverMessage = body.error.trim();
        }
      } catch {
        // Non-JSON error body; fall through to default handling
      }
      if (serverMessage) {
        throw new Error(serverMessage);
      }
    }
    return res;
  },
});

export function Site({ starters }: SiteProps) {
  const reduce = useReducedMotion();
  const [input, setInput] = useState("");
  const [replayBusy, setReplayBusy] = useState(false);
  const [usedStarterIds, setUsedStarterIds] = useState<string[]>([]);
  const [liveAsked, setLiveAsked] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fakeRef = useRef<{
    timer: number;
    cancelled: boolean;
    finalMessages: SiteUIMessage[] | null;
  }>({
    timer: 0,
    cancelled: false,
    finalMessages: null,
  });

  const {
    messages,
    sendMessage,
    setMessages,
    regenerate,
    clearError,
    status,
    error,
    stop,
  } = useChat<SiteUIMessage>({
    transport: chatTransport,
    onFinish: ({ isError, isAbort }) => {
      if (!isError && !isAbort) {
        setLiveAsked((count) => count + 1);
      }
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [messages, status, replayBusy, reduce]);

  useEffect(
    () => () => {
      fakeRef.current.cancelled = true;
      window.clearTimeout(fakeRef.current.timer);
    },
    [],
  );

  const networkBusy = status === "submitted" || status === "streaming";
  const busy = networkBusy || replayBusy;
  const capped = liveAsked >= MAX_USER_MESSAGES;
  const empty = messages.length === 0;
  const last = messages.at(-1);

  const lastPart = last?.role === "assistant" ? last.parts.at(-1) : undefined;
  const streamingTextNow =
    (networkBusy && lastPart?.type === "text" && Boolean(lastPart.text)) ||
    replayBusy;

  const waitingForNextStep =
    status === "submitted" ||
    (status === "streaming" && !streamingTextNow) ||
    (replayBusy &&
      !(
        last?.role === "assistant" &&
        last.parts.some((p) => isTextUIPart(p) && p.text.length > 0)
      ));

  const remainingStarters = useMemo(
    () => starters.filter((s) => !usedStarterIds.includes(s.id)),
    [starters, usedStarterIds],
  );

  function cancelFake() {
    fakeRef.current.cancelled = true;
    window.clearTimeout(fakeRef.current.timer);
    fakeRef.current.finalMessages = null;
    setReplayBusy(false);
  }

  function flushFake(): SiteUIMessage[] {
    if (!replayBusy) return messages;
    const completed = fakeRef.current.finalMessages ?? messages;
    fakeRef.current.cancelled = true;
    window.clearTimeout(fakeRef.current.timer);
    fakeRef.current.finalMessages = null;
    setReplayBusy(false);
    setMessages(completed);
    return completed;
  }

  function resetTextareaHeight() {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function resetChat() {
    cancelFake();
    if (networkBusy) stop();
    clearError();
    setMessages([]);
    setUsedStarterIds([]);
    setLiveAsked(0);
    setInput("");
    resetTextareaHeight();
  }

  function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || networkBusy || capped) return;

    if (replayBusy) {
      flushFake();
    }
    if (error) {
      clearError();
    }

    sendMessage({ text: trimmed });
    setInput("");
    resetTextareaHeight();
  }

  function onStarter(starter: Starter) {
    if (networkBusy) return;

    const baseMessages = replayBusy ? flushFake() : messages;
    if (error) {
      clearError();
    }

    const user = makeMessage("user", starter.question);
    const fullAssistant = makeMessage("assistant", starter.answer);
    const completedHistory = [...baseMessages, user, fullAssistant];

    setUsedStarterIds((prev) =>
      prev.includes(starter.id) ? prev : [...prev, starter.id],
    );

    if (reduce) {
      setMessages(completedHistory);
      return;
    }

    fakeRef.current.cancelled = false;
    fakeRef.current.finalMessages = completedHistory;
    setReplayBusy(true);
    setMessages([...baseMessages, user]);

    const streamingAssistant = makeMessage("assistant", "");
    const chunks = fakeTokens(starter.answer);
    let i = 0;
    let acc = "";

    const step = () => {
      if (fakeRef.current.cancelled) {
        setReplayBusy(false);
        return;
      }
      if (i >= chunks.length) {
        fakeRef.current.finalMessages = null;
        setReplayBusy(false);
        return;
      }
      acc += chunks[i++];
      setMessages([
        ...baseMessages,
        user,
        { ...streamingAssistant, parts: [{ type: "text", text: acc }] },
      ]);
      fakeRef.current.timer = window.setTimeout(step, 8 + Math.random() * 10);
    };

    fakeRef.current.timer = window.setTimeout(step, 140);
  }

  const errorText = useMemo(() => {
    if (!error) return "";
    const msg = error.message?.trim();
    if (!msg || msg === "Failed to fetch") {
      return "Couldn't reach the chat service. Check your connection and try again.";
    }
    return msg;
  }, [error]);

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-background">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-5 sm:px-8">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`flex min-h-0 flex-1 flex-col pb-5 ${
            empty ? "justify-center" : ""
          }`}
        >
          <header
            className={`flex shrink-0 items-baseline justify-between gap-4 ${
              empty ? "mb-7" : "pt-5 pb-3.5 sm:pt-7"
            }`}
          >
            <h1
              className={`welcome-type ${
                empty
                  ? "text-[clamp(2.2rem,6.4vw,3.85rem)]"
                  : "text-[clamp(1.15rem,2.4vw,1.55rem)]"
              }`}
            >
              <StaggerLine text="Ask me anything." delay={0} active={!reduce && empty} />
            </h1>

            {!empty ? (
              <button
                type="button"
                onClick={resetChat}
                className="rounded-full border border-[var(--line)] px-3 py-1 font-mono text-[11px] tracking-wide text-[var(--muted)] transition-colors hover:border-[var(--fg)]/35 hover:text-[var(--fg)]"
              >
                New chat
              </button>
            ) : null}
          </header>

          {!empty ? (
            <div
              role="log"
              aria-live="polite"
              className="chat-scroll min-h-0 flex-1 space-y-6 overflow-y-auto pr-1"
            >
              {messages.map((message, idx) => {
                const isLast = idx === messages.length - 1;
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    streaming={isLast && streamingTextNow}
                  />
                );
              })}

              {waitingForNextStep ? (
                <p className="font-mono text-[11px] tracking-wide text-[var(--muted)] animate-pulse">
                  thinking…
                </p>
              ) : null}

              {error ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-white/[0.02] px-3.5 py-2.5 text-sm text-[var(--muted)]">
                  <span>{errorText}</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      regenerate();
                    }}
                    className="rounded-full border border-[var(--line)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--fg)] transition-colors hover:border-[var(--fg)]/45"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {capped && !error ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                  <span>
                    That&apos;s {MAX_USER_MESSAGES} questions in this session.
                  </span>
                  <button
                    type="button"
                    onClick={resetChat}
                    className="rounded-full border border-[var(--line)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--fg)] transition-colors hover:border-[var(--fg)]/45"
                  >
                    Start new chat
                  </button>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>
          ) : null}

          {remainingStarters.length > 0 ? (
            <div
              className={`flex shrink-0 flex-wrap gap-2 ${
                empty ? "mb-4" : "mt-3"
              }`}
            >
              {remainingStarters.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  disabled={networkBusy}
                  onClick={() => onStarter(starter)}
                  className={`rounded-full border border-[var(--line)] bg-[var(--chip)] text-left text-[var(--fg)] transition-colors hover:border-[var(--fg)]/35 disabled:opacity-40 ${
                    empty ? "px-3.5 py-2 text-sm" : "px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {starter.label}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="mt-3 shrink-0"
            onSubmit={(event) => {
              event.preventDefault();
              submitText(input);
            }}
          >
            <div className="flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-black/40 px-3 py-2 focus-within:border-[var(--fg)]/30">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  const el = event.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitText(input);
                  }
                }}
                rows={1}
                aria-label="Ask Erick"
                placeholder="Ask about Google, infer, TinyTrains, golf, Copenhagen…"
                disabled={networkBusy || capped}
                className="max-h-36 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base outline-none placeholder:text-[var(--muted)] disabled:opacity-50"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => {
                    if (replayBusy) {
                      flushFake();
                    } else {
                      stop();
                    }
                  }}
                  className="mb-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--fg)]/35 hover:text-[var(--fg)]"
                >
                  {replayBusy ? "Skip" : "Stop"}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || capped}
                  className="mb-1.5 rounded-full bg-[var(--fg)] px-3.5 py-1.5 text-xs font-medium text-black transition-opacity disabled:opacity-30"
                >
                  Send
                </button>
              )}
            </div>
          </form>
        </motion.section>
      </div>
    </main>
  );
}

function StaggerLine({
  text,
  delay,
  active,
}: {
  text: string;
  delay: number;
  active: boolean;
}) {
  const words = text.split(" ");
  return (
    <span className="block">
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block"
          initial={active ? { y: 12, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: 0.55,
            delay: delay + index * 0.06,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
          {index < words.length - 1 ? "\u00a0" : ""}
        </motion.span>
      ))}
    </span>
  );
}

function fakeTokens(text: string) {
  const chunks: string[] = [];
  const link = /(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  for (const match of text.matchAll(link)) {
    const start = match.index ?? 0;
    if (start > last) pushWords(text.slice(last, start), chunks);
    chunks.push(match[0]);
    last = start + match[0].length;
  }
  if (last < text.length) pushWords(text.slice(last), chunks);
  return chunks;
}

function pushWords(text: string, chunks: string[]) {
  const parts = text.split(/(\s+)/);
  let buf = "";
  let words = 0;
  for (const part of parts) {
    if (!part) continue;
    buf += part;
    if (!/^\s+$/.test(part)) words += 1;
    if (words >= 3 || buf.length >= 26) {
      chunks.push(buf);
      buf = "";
      words = 0;
    }
  }
  if (buf) chunks.push(buf);
}

function MessageBubble({
  message,
  streaming = false,
}: {
  message: UIMessage;
  streaming?: boolean;
}) {
  const mine = message.role === "user";
  const hasVisiblePart = message.parts.some(
    (part) => (isTextUIPart(part) && part.text.trim().length > 0) || isToolUIPart(part),
  );

  if (!mine && !hasVisiblePart) {
    return null;
  }

  let lastTextIndex = -1;
  for (let idx = message.parts.length - 1; idx >= 0; idx -= 1) {
    const candidate = message.parts[idx];
    if (isTextUIPart(candidate) && candidate.text.length > 0) {
      lastTextIndex = idx;
      break;
    }
  }

  const toolParts = !mine ? message.parts.filter(isToolUIPart) : [];
  const textParts = message.parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => isTextUIPart(part) && part.text.length > 0);

  return (
    <article className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] ${mine ? "text-right" : ""}`}>
        <p className="mb-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
          {mine ? "You" : "Erick"}
        </p>

        {toolParts.length > 0 ? (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {toolParts.map((part) => (
              <ToolBadge key={part.toolCallId} part={part} />
            ))}
          </div>
        ) : null}

        <div className="space-y-3 text-[15px] leading-7 sm:text-base">
          {textParts.map(({ part, index }) =>
            isTextUIPart(part) ? (
              <MarkdownBlocks
                key={index}
                text={part.text}
                mine={mine}
                streaming={streaming && index === lastTextIndex}
              />
            ) : null,
          )}
        </div>
      </div>
    </article>
  );
}

function ToolBadge({
  part,
}: {
  part: Extract<UIMessage["parts"][number], { toolCallId: string }>;
}) {
  const rawName =
    part.type === "dynamic-tool"
      ? part.toolName
      : part.type.startsWith("tool-")
        ? part.type.slice(5)
        : "tool";

  const state = "state" in part ? String(part.state) : "";
  const done = state === "output-available" || state === "output-error";
  const input =
    "input" in part && part.input && typeof part.input === "object"
      ? (part.input as Record<string, unknown>)
      : undefined;

  let label = rawName.replaceAll("_", " ");
  if (rawName === "list_docs") {
    label = done ? "listed dossier" : "listing dossier…";
  } else if (rawName === "search_docs") {
    const q = typeof input?.query === "string" ? input.query : "";
    label = q
      ? `${done ? "searched" : "searching"} "${q}"`
      : done
        ? "searched dossier"
        : "searching dossier…";
  } else if (rawName === "read_doc") {
    const p = typeof input?.path === "string" ? input.path : "";
    label = p
      ? `${done ? "read" : "reading"} ${p}`
      : done
        ? "read doc"
        : "reading doc…";
  } else if (rawName === "read_docs") {
    const paths = Array.isArray(input?.paths)
      ? input.paths.filter((x): x is string => typeof x === "string")
      : [];
    const target = paths.length > 0 ? paths.join(", ") : "docs";
    label = `${done ? "read" : "reading"} ${target}`;
  } else if (!done) {
    label = `${label}…`;
  }

  return (
    <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-white/[0.02] px-2.5 py-0.5 font-mono text-[11px] text-[var(--muted)]">
      {label}
    </span>
  );
}

function CursorCaret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1.05em] w-[0.42em] translate-y-0.5 bg-[var(--fg)] align-baseline"
    />
  );
}

function MarkdownBlocks({
  text,
  mine,
  streaming,
}: {
  text: string;
  mine: boolean;
  streaming: boolean;
}) {
  if (mine) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  const segments = splitCodeFences(text);
  return (
    <div className="space-y-3">
      {segments.map((seg, segIdx) => {
        const isLastSeg = segIdx === segments.length - 1;
        if (seg.kind === "code") {
          return (
            <pre
              key={segIdx}
              className="overflow-x-auto rounded-xl border border-[var(--line)] bg-black/50 px-3.5 py-2.5 font-mono text-[13px] leading-6 text-[var(--fg)]"
            >
              <code>
                {seg.content}
                {streaming && isLastSeg ? <CursorCaret /> : null}
              </code>
            </pre>
          );
        }
        return (
          <ProseBlocks
            key={segIdx}
            text={seg.content}
            streaming={streaming && isLastSeg}
          />
        );
      })}
    </div>
  );
}

function splitCodeFences(
  text: string,
): Array<{ kind: "prose" | "code"; content: string }> {
  const result: Array<{ kind: "prose" | "code"; content: string }> = [];
  const fenceRe = /```[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  for (const match of text.matchAll(fenceRe)) {
    const start = match.index ?? 0;
    if (start > last) {
      result.push({ kind: "prose", content: text.slice(last, start) });
    }
    result.push({ kind: "code", content: (match[1] ?? "").replace(/\n$/, "") });
    last = start + match[0].length;
  }
  if (last < text.length) {
    result.push({ kind: "prose", content: text.slice(last) });
  }
  return result.length > 0 ? result : [{ kind: "prose", content: text }];
}

function ProseBlocks({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  type ListItem = { text: string; nested: boolean };
  type Block =
    | { type: "heading"; text: string }
    | { type: "hr" }
    | { type: "ul"; items: ListItem[] }
    | { type: "ol"; items: string[] }
    | { type: "p"; lines: string[] };

  const blocks: Block[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (blocks.at(-1)?.type === "p") {
        blocks.push({ type: "p", lines: [] });
      }
      continue;
    }

    if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", text: headingMatch[1] });
      continue;
    }

    const ulMatch = line.match(/^(\s*)[-*•]\s+(.+)$/);
    if (ulMatch) {
      const nested = (ulMatch[1]?.length ?? 0) >= 2;
      const item: ListItem = { text: ulMatch[2].trim(), nested };
      const prev = blocks.at(-1);
      if (prev?.type === "ul") {
        prev.items.push(item);
      } else {
        blocks.push({ type: "ul", items: [item] });
      }
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      const prev = blocks.at(-1);
      if (prev?.type === "ol") {
        prev.items.push(olMatch[1]);
      } else {
        blocks.push({ type: "ol", items: [olMatch[1]] });
      }
      continue;
    }

    const prev = blocks.at(-1);
    if (prev?.type === "p") {
      prev.lines.push(line);
    } else {
      blocks.push({ type: "p", lines: [line] });
    }
  }

  const nonEmptyBlocks = blocks.filter(
    (b) => b.type !== "p" || b.lines.length > 0,
  );

  return (
    <div className="space-y-2.5">
      {nonEmptyBlocks.map((block, bIdx) => {
        const isLastBlock = bIdx === nonEmptyBlocks.length - 1;
        if (block.type === "hr") {
          return <hr key={bIdx} className="my-2 border-[var(--line)]" />;
        }
        if (block.type === "heading") {
          return (
            <h3
              key={bIdx}
              className="pt-1 font-medium tracking-tight text-[var(--fg)]"
            >
              {renderInline(block.text)}
              {streaming && isLastBlock ? <CursorCaret /> : null}
            </h3>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={bIdx} className="list-disc space-y-1.5 pl-5">
              {block.items.map((item, iIdx) => (
                <li
                  key={iIdx}
                  className={item.nested ? "ml-4 list-[circle]" : undefined}
                >
                  {renderInline(item.text)}
                  {streaming && isLastBlock && iIdx === block.items.length - 1 ? (
                    <CursorCaret />
                  ) : null}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={bIdx} className="list-decimal space-y-1.5 pl-5">
              {block.items.map((item, iIdx) => (
                <li key={iIdx}>
                  {renderInline(item)}
                  {streaming && isLastBlock && iIdx === block.items.length - 1 ? (
                    <CursorCaret />
                  ) : null}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bIdx} className="whitespace-pre-wrap">
            {renderInline(block.lines.join("\n"))}
            {streaming && isLastBlock ? <CursorCaret /> : null}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string, allowLinks = true): ReactNode[] {
  const token = allowLinks
    ? /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|(https?:\/\/[^\s<>()]+)|((?:github\.com|linkedin\.com|www\.linkedin\.com|x\.com|www\.x\.com|docs\.google\.com)\/[^\s<>()]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
    : /`([^`]+)`|\*\*([^*]+)\*\*/g;

  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(token)) {
    const start = match.index ?? 0;
    if (start > last) {
      nodes.push(text.slice(last, start));
    }

    if (!allowLinks) {
      if (match[1] !== undefined) {
        nodes.push(
          <code
            key={key++}
            className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.88em]"
          >
            {match[1]}
          </code>,
        );
      } else if (match[2] !== undefined) {
        nodes.push(
          <strong key={key++} className="font-semibold text-[var(--fg)]">
            {renderInline(match[2], false)}
          </strong>,
        );
      }
      last = start + match[0].length;
      continue;
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      const href = match[2];
      const external = href.startsWith("http");
      nodes.push(
        <a
          key={key++}
          href={href}
          className="text-[var(--fg)] underline decoration-[var(--fg)]/45 underline-offset-4 transition-colors hover:decoration-[var(--fg)]"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {renderInline(match[1], false)}
        </a>,
      );
      last = start + match[0].length;
      continue;
    }

    if (match[3] !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.88em]"
        >
          {match[3]}
        </code>,
      );
      last = start + match[0].length;
      continue;
    }

    if (match[4] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[var(--fg)]">
          {renderInline(match[4], allowLinks)}
        </strong>,
      );
      last = start + match[0].length;
      continue;
    }

    if (match[5] !== undefined || match[6] !== undefined) {
      const rawUrl = match[5] ?? match[6] ?? "";
      const stripped = rawUrl.replace(/[.,;:!?]+$/, "");
      const trailing = rawUrl.slice(stripped.length);
      const href = stripped.startsWith("http") ? stripped : `https://${stripped}`;
      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--fg)] underline decoration-[var(--fg)]/45 underline-offset-4 transition-colors hover:decoration-[var(--fg)]"
        >
          {stripped}
        </a>,
      );
      if (trailing) nodes.push(trailing);
      last = start + match[0].length;
      continue;
    }

    if (match[7] !== undefined) {
      const email = match[7];
      nodes.push(
        <a
          key={key++}
          href={`mailto:${email}`}
          className="text-[var(--fg)] underline decoration-[var(--fg)]/45 underline-offset-4 transition-colors hover:decoration-[var(--fg)]"
        >
          {email}
        </a>,
      );
      last = start + match[0].length;
      continue;
    }

    last = start + match[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}
