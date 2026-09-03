import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { listDocs, readDoc, searchDocs } from "@/lib/docs";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { killSwitchOn, resolveModel } from "@/lib/provider";
import { MAX_MESSAGES } from "@/lib/limits";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

const tools = {
  list_docs: tool({
    description:
      "List public dossier file paths (about, work, projects, hobbies, contact, resume).",
    inputSchema: z.object({}),
    execute: async () => ({ files: listDocs() }),
  }),
  search_docs: tool({
    description: "Keyword search over the public dossier. Use before reading blindly.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Plain keyword or short phrase"),
    }),
    execute: async ({ query }) => ({ hits: searchDocs(query) }),
  }),
  read_doc: tool({
    description: "Read one public dossier file by path from list_docs.",
    inputSchema: z.object({
      path: z.string().min(1).describe("Relative path such as about.md or work/google.md"),
    }),
    execute: async ({ path }) => {
      try {
        return readDoc(path);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "read failed" };
      }
    },
  }),
};

export async function POST(req: Request) {
  if (killSwitchOn()) {
    return Response.json({ error: "Chat is temporarily disabled." }, { status: 503 });
  }

  const limited = rateLimit(clientIp(req));
  if (!limited.ok) {
    return Response.json(
      { error: "Too many questions. Try again in a bit." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfter) },
      },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages." }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return Response.json(
      { error: "This chat is long enough. Refresh for a new one." },
      { status: 400 },
    );
  }

  let model: ReturnType<typeof resolveModel>;
  try {
    model = resolveModel();
  } catch (error) {
    if (error instanceof Error && error.message === "NO_BACKEND") {
      return Response.json(
        { error: "AI Gateway is not configured." },
        { status: 503 },
      );
    }
    throw error;
  }

  const result = streamText({
    model,
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(6),
    maxOutputTokens: 900,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
