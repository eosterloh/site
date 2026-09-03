import { PUBLIC_DOCS } from "./public-docs.generated";

const MAX_READ_CHARS = 12_000;
const MAX_SEARCH_HITS = 8;
const SNIPPET_CHARS = 280;

function normalizePath(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function isSafePath(rel: string): boolean {
  if (!rel || rel.includes("..") || rel.startsWith("private/")) return false;
  if (rel.split("/").includes("private")) return false;
  return Object.hasOwn(PUBLIC_DOCS, rel);
}

export function listDocs(): string[] {
  return Object.keys(PUBLIC_DOCS).sort();
}

export function readDoc(path: string): { path: string; content: string } {
  const rel = normalizePath(path);
  if (!isSafePath(rel)) {
    throw new Error(`Unknown or blocked path: ${path}`);
  }
  const content = PUBLIC_DOCS[rel];
  if (content.length <= MAX_READ_CHARS) {
    return { path: rel, content };
  }
  return {
    path: rel,
    content: `${content.slice(0, MAX_READ_CHARS)}\n\n[truncated]`,
  };
}

export function searchDocs(query: string): {
  path: string;
  snippet: string;
}[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { path: string; snippet: string; score: number }[] = [];
  for (const [path, content] of Object.entries(PUBLIC_DOCS)) {
    const lower = content.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) continue;
    const start = Math.max(0, idx - 80);
    const snippet = content.slice(start, start + SNIPPET_CHARS).replace(/\s+/g, " ").trim();
    hits.push({ path, snippet, score: idx });
  }
  return hits
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_SEARCH_HITS)
    .map(({ path, snippet }) => ({ path, snippet }));
}
