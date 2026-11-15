import {
  ToolLoopAgent,
  isStepCount,
  tool,
  type InferAgentUIMessage,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { describeDocs, listDocs, readDoc, readDocs, searchDocs } from "@/lib/docs";
import { MAX_AGENT_STEPS } from "@/lib/limits";
import { buildSystemPrompt } from "@/lib/prompt";
import { resolveModel, resolveProviderOptions } from "@/lib/provider";

export const dossierTools = {
  list_docs: tool({
    description:
      "List every public dossier file path with its title and one-line summary.",
    inputSchema: z.object({}),
    execute: async () => ({ files: describeDocs() }),
  }),
  search_docs: tool({
    description:
      "Search across all public dossier titles, paths, and contents by keywords or topic. Follow up with read_doc or read_docs on matching files for full details.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe("Keywords or topic phrase, e.g. 'Google latency' or 'golf irons'"),
    }),
    execute: async ({ query }) => ({ hits: searchDocs(query) }),
  }),
  read_doc: tool({
    description:
      "Read one public dossier file (e.g. 'about.md', 'work/google.md', 'projects/infer.md') or an entire folder ('projects', 'work', 'hobbies', 'education').",
    inputSchema: z.object({
      path: z
        .string()
        .min(1)
        .describe("Relative file path or folder name from the public dossier"),
    }),
    execute: async ({ path }) => {
      try {
        return readDoc(path);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "read failed",
          availableFiles: listDocs(),
        };
      }
    },
  }),
  read_docs: tool({
    description:
      "Batch-read multiple public dossier files or folders in a single step (e.g. ['resume.md', 'projects'] or ['work/google.md', 'work/paynearme.md']). Prefer this whenever a question spans multiple files.",
    inputSchema: z.object({
      paths: z
        .array(z.string().min(1))
        .min(1)
        .max(12)
        .describe("List of relative file paths or folder names to read at once"),
    }),
    execute: async ({ paths }) => readDocs(paths),
  }),
} satisfies ToolSet;

export function createSiteAgent() {
  return new ToolLoopAgent({
    model: resolveModel(),
    instructions: buildSystemPrompt(),
    tools: dossierTools,
    stopWhen: isStepCount(MAX_AGENT_STEPS),
    maxOutputTokens: 2400,
    providerOptions: resolveProviderOptions(),
    prepareStep: ({ stepNumber }) => {
      if (stepNumber >= MAX_AGENT_STEPS - 1) {
        return {
          activeTools: [],
          toolChoice: "none",
        };
      }
      return {};
    },
  });
}

export type SiteUIMessage = InferAgentUIMessage<ReturnType<typeof createSiteAgent>>;
