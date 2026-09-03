"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId, type UIMessage } from "ai";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Starter } from "@/lib/starters";
import { MAX_USER_MESSAGES } from "@/lib/limits";

type SiteProps = { starters: Starter[] };

function makeMessage(role: "user" | "assistant", text: string): UIMessage {
  return {
    id: generateId(),
    role,
    parts: [{ type: "text", text }],
  };
}

export function Site({ starters }: SiteProps) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"entrance" | "chat">(reduce ? "chat" : "entrance");
  const [input, setInput] = useState("");
  const [replayBusy, setReplayBusy] = useState(false);
  const [liveAsked, setLiveAsked] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fakeRef = useRef<{ timer: number; cancelled: boolean }>({
    timer: 0,
    cancelled: false,
  });

  const { messages, sendMessage, setMessages, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  useEffect(() => {
    if (reduce) return;
    const skip = () => setPhase("chat");
    window.addEventListener("keydown", skip);
    const timer = window.setTimeout(skip, 3400);
    return () => {
      window.removeEventListener("keydown", skip);
      window.clearTimeout(timer);
    };
  }, [reduce]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [messages, status, reduce]);

  useEffect(
    () => () => {
      fakeRef.current.cancelled = true;
      window.clearTimeout(fakeRef.current.timer);
    },
    [],
  );

  const busy = status === "submitted" || status === "streaming" || replayBusy;
  const capped = liveAsked >= MAX_USER_MESSAGES;
  const empty = messages.length === 0;
  const firstTurn = messages.length > 0 && messages.length <= 2;
  const centered = empty || firstTurn;
  const last = messages.at(-1);
  const lastText =
    last?.role === "assistant"
      ? last.parts.find((part) => part.type === "text")?.text ?? ""
      : "";
  const thinking = status === "submitted" || (replayBusy && !lastText);

  function cancelFake() {
    fakeRef.current.cancelled = true;
    window.clearTimeout(fakeRef.current.timer);
    setReplayBusy(false);
  }

  function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || capped) return;
    setPhase("chat");
    sendMessage({ text: trimmed });
    setLiveAsked((count) => count + 1);
    setInput("");
  }

  function onStarter(starter: Starter) {
    if (busy) return;
    setPhase("chat");
    const user = makeMessage("user", starter.question);
    if (reduce) {
      setMessages([user, makeMessage("assistant", starter.answer)]);
      return;
    }

    fakeRef.current.cancelled = false;
    setReplayBusy(true);
    setMessages([user]);

    const assistant = makeMessage("assistant", "");
    const chunks = fakeTokens(starter.answer);
    let i = 0;
    let acc = "";

    const step = () => {
      if (fakeRef.current.cancelled) {
        setReplayBusy(false);
        return;
      }
      if (i >= chunks.length) {
        setReplayBusy(false);
        return;
      }
      acc += chunks[i++];
      setMessages([user, { ...assistant, parts: [{ type: "text", text: acc }] }]);
      fakeRef.current.timer = window.setTimeout(step, 10 + Math.random() * 14);
    };

    fakeRef.current.timer = window.setTimeout(step, 240);
  }

  const composer = (
    <form
      className="mt-4 shrink-0"
      onSubmit={(event) => {
        event.preventDefault();
        submitText(input);
      }}
    >
      <div className="flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-black/40 px-3 py-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitText(input);
            }
          }}
          rows={1}
          aria-label="Ask Erick"
          placeholder="Ask about work, golf, hoops…"
          disabled={busy || capped}
          className="max-h-36 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base outline-none placeholder:text-[var(--muted)] disabled:opacity-50"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => {
              cancelFake();
              stop();
            }}
            className="mb-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)]"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || capped}
            className="mb-1.5 rounded-full bg-[var(--fg)] px-3.5 py-1.5 text-xs font-medium text-black disabled:opacity-30"
          >
            Send
          </button>
        )}
      </div>
    </form>
  );

  return (
    <main
      className="relative flex h-dvh flex-col overflow-hidden bg-background"
      onClick={phase === "entrance" ? () => setPhase("chat") : undefined}
    >
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-5 sm:px-8">
        {phase === "entrance" ? (
          <header className="flex min-h-0 flex-1 flex-col justify-center pb-[8vh]">
            <h1 className="welcome-type text-[clamp(2.35rem,8.4vw,5.6rem)]">
              <StaggerLine text="Ask me anything." delay={0} active={!reduce} />
            </h1>
            <button
              type="button"
              onClick={() => setPhase("chat")}
              className="mt-16 self-start text-left text-xs tracking-[0.18em] text-[var(--muted)] uppercase"
            >
              Click or press any key
            </button>
          </header>
        ) : (
          <motion.section
            key="chat"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`flex min-h-0 flex-1 flex-col pb-5 ${
              centered ? "justify-center" : ""
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <h1
              className={`welcome-type shrink-0 ${
                centered
                  ? "mb-8 text-[clamp(1.85rem,5vw,3.1rem)]"
                  : "pt-6 pb-4 text-[clamp(1.15rem,2.4vw,1.65rem)] sm:pt-8"
              }`}
            >
              Ask me anything.
            </h1>

            <div
              className={`space-y-6 pr-1 ${
                centered
                  ? "shrink-0"
                  : "chat-scroll min-h-0 flex-1 overflow-y-auto"
              }`}
            >
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  streaming={
                    replayBusy && message.role === "assistant" && Boolean(lastText)
                  }
                />
              ))}
              {thinking ? (
                <p className="font-mono text-[11px] tracking-wide text-[var(--muted)]">
                  thinking
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-[var(--muted)]">
                  Something went wrong.
                </p>
              ) : null}
              {capped && !error ? (
                <p className="text-sm text-[var(--muted)]">
                  That's enough questions for now.
                </p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {empty ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <button
                    key={starter.id}
                    type="button"
                    onClick={() => onStarter(starter)}
                    className="rounded-full border border-[var(--line)] bg-[var(--chip)] px-3.5 py-2 text-left text-sm text-[var(--fg)] transition-colors hover:border-[var(--fg)]/35"
                  >
                    {starter.label}
                  </button>
                ))}
              </div>
            ) : null}

            {composer}
          </motion.section>
        )}
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
          initial={active ? { y: 14 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: 0.7,
            delay: delay + index * 0.07,
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
    if (words >= 2 || buf.length >= 22) {
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
  if (!mine && !message.parts.some((part) => part.type === "text" && part.text)) {
    return null;
  }
  return (
    <article className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] ${mine ? "text-right" : ""}`}>
        <p className="mb-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
          {mine ? "You" : "Erick"}
        </p>
        <div className="space-y-2 text-[15px] leading-7 sm:text-base">
          {message.parts.map((part, index) => (
            <PartView
              key={index}
              part={part}
              streaming={streaming && index === message.parts.length - 1}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function linkify(text: string) {
  const token =
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)|(https?:\/\/[^\s]+)/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(token)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const href = match[2] ?? match[3] ?? "";
    const label = match[1] ?? href;
    const external = href.startsWith("http");
    nodes.push(
      <a
        key={key++}
        href={href}
        className="underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--fg)]"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function PartView({
  part,
  streaming = false,
}: {
  part: UIMessage["parts"][number];
  streaming?: boolean;
}) {
  if (part.type === "text") {
    return (
      <p className="whitespace-pre-wrap">
        {linkify(part.text)}
        {streaming ? (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-[1.05em] w-[0.42em] translate-y-0.5 bg-[var(--fg)] align-baseline"
          />
        ) : null}
      </p>
    );
  }
  if (part.type.startsWith("tool-")) {
    const name = part.type.slice(5).replaceAll("_", " ");
    const state = "state" in part ? String(part.state) : "";
    const done = state === "output-available" || state === "output-error";
    return (
      <span className="mr-2 inline-flex items-center rounded-full border border-[var(--line)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--muted)]">
        {done ? `${name}` : `${name}…`}
      </span>
    );
  }
  return null;
}
