import {
  createAgentUIStreamResponse,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { createSiteAgent } from "@/lib/agent";
import { MAX_INPUT_CHARS, MAX_MESSAGES } from "@/lib/limits";
import { killSwitchOn } from "@/lib/provider";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

function sanitizeUIMessages(raw: unknown[]): UIMessage[] {
  const cleaned: UIMessage[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const msg = item as Partial<UIMessage>;
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    if (!Array.isArray(msg.parts)) continue;

    const validParts = msg.parts.filter((part) => {
      if (!part || typeof part !== "object" || typeof part.type !== "string") {
        return false;
      }
      if (isToolUIPart(part)) {
        return part.state === "output-available" || part.state === "output-error";
      }
      if (isTextUIPart(part)) {
        return typeof part.text === "string" && part.text.trim().length > 0;
      }
      return part.type === "step-start";
    });

    const hasSubstance = validParts.some(
      (part) =>
        (isTextUIPart(part) && part.text.trim().length > 0) || isToolUIPart(part),
    );
    if (!hasSubstance) continue;

    cleaned.push({
      id: typeof msg.id === "string" && msg.id ? msg.id : crypto.randomUUID(),
      role: msg.role,
      parts: validParts,
    });
  }

  // If a prior user turn was aborted/failed and followed directly by a newer user turn,
  // drop the orphaned earlier user turn so the model answers only the active question.
  const deduped: UIMessage[] = [];
  for (const msg of cleaned) {
    if (msg.role === "user" && deduped.at(-1)?.role === "user") {
      deduped[deduped.length - 1] = msg;
    } else {
      deduped.push(msg);
    }
  }

  if (deduped.length <= MAX_MESSAGES) {
    return deduped;
  }

  const sliced = deduped.slice(-MAX_MESSAGES);
  const firstUserIdx = sliced.findIndex((m) => m.role === "user");
  return firstUserIdx > 0 ? sliced.slice(firstUserIdx) : sliced;
}

function formatStreamError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("429") || msg.includes("quota")) {
      return "Model rate limit hit. Try again in a moment.";
    }
    if (msg.includes("authentication") || msg.includes("401") || msg.includes("403") || msg.includes("oidc")) {
      return "Model backend authentication is unavailable right now.";
    }
    if (msg.includes("timeout") || msg.includes("aborted")) {
      return "Request timed out. Try asking again.";
    }
  }
  return "Something went wrong generating a reply. Try again.";
}

export async function POST(req: Request) {
  if (killSwitchOn()) {
    return Response.json(
      { error: "Chat is temporarily disabled." },
      { status: 503 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "No messages." }, { status: 400 });
  }

  const messages = sanitizeUIMessages(body.messages);
  const last = messages.at(-1);
  if (!last || last.role !== "user") {
    return Response.json(
      { error: "Last message must be a question from you." },
      { status: 400 },
    );
  }

  const lastUserText = last.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("\n")
    .trim();

  if (!lastUserText) {
    return Response.json({ error: "Empty message." }, { status: 400 });
  }
  if (lastUserText.length > MAX_INPUT_CHARS) {
    return Response.json(
      { error: `Keep questions under ${MAX_INPUT_CHARS} characters.` },
      { status: 400 },
    );
  }

  const limited = rateLimit(clientIp(req));
  if (!limited.ok) {
    return Response.json(
      { error: "Too many questions right now. Try again in a bit." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfter) },
      },
    );
  }

  let agent: ReturnType<typeof createSiteAgent>;
  try {
    agent = createSiteAgent();
  } catch (error) {
    if (error instanceof Error && error.message === "NO_BACKEND") {
      return Response.json(
        {
          error:
            "Model backend isn't configured yet (set AI_GATEWAY_API_KEY, VERCEL_OIDC_TOKEN, or OPENROUTER_API_KEY).",
        },
        { status: 503 },
      );
    }
    throw error;
  }

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    abortSignal: req.signal,
    onError: formatStreamError,
  });
}
