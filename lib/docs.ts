import { PUBLIC_DOCS } from "./public-docs.generated";

const MAX_READ_CHARS = 16_000;
const MAX_SEARCH_HITS = 8;
const SNIPPET_CHARS = 520;

export type DocSummary = {
  path: string;
  title: string;
  summary: string;
};

export type DocContent = {
  path: string;
  content: string;
};

export type SearchHit = {
  path: string;
  title: string;
  snippet: string;
};

const SYNONYM_GROUPS: string[][] = [
  ["intern", "internship", "internships", "interned", "work", "experience", "career", "job", "jobs", "swe"],
  ["project", "projects", "built", "build", "shipping", "ship", "ships", "repo", "repos", "github", "code", "portfolio"],
  ["school", "college", "university", "education", "degree", "major", "gpa", "grades", "course", "courses", "coursework", "classes", "class", "study", "abroad", "copenhagen"],
  ["golf", "golfer", "handicap", "bag", "clubs", "driver", "irons", "titleist", "swing", "wearos", "watch", "pixel"],
  ["hoops", "basketball", "ball", "sport", "sports", "hobby", "hobbies", "free"],
  ["contact", "reach", "email", "mail", "linkedin", "github", "twitter", "x", "social", "links", "resume", "cv"],
  ["rsi", "tinytrains", "tinytrain", "autoresearch", "auto-research", "lab", "tinystories", "harness", "harnesses"],
  ["infer", "inference", "decoder", "kernels", "cuda", "nvfp4", "fp8", "spark", "dgx", "nemotron", "mamba", "moe", "llama", "logits"],
  ["mcp", "dossier", "personal", "context", "openclaw"],
  ["rag", "llamaindex", "ragas", "phoenix", "arize", "eval", "evals", "paynearme"],
  ["google", "conversions", "conversion", "conduit", "sql", "dashboard", "petabyte", "analytics"],
  ["skill", "skills", "stack", "tech", "languages", "language", "python", "cpp", "c++", "java", "go", "javascript", "pytorch", "tensorflow"],
];

function stripCandidatePrefix(raw: string): string {
  let clean = raw.replace(/\\/g, "/").trim().replace(/^\/+/, "");
  if (clean.startsWith("content/public/")) {
    clean = clean.slice("content/public/".length);
  } else if (clean.startsWith("public/")) {
    clean = clean.slice("public/".length);
  }
  return clean.replace(/\/+$/, "");
}

function isBlockedPath(raw: string): boolean {
  const normalized = raw.replace(/\\/g, "/").trim();
  if (!normalized || normalized.includes("..")) return true;
  const segments = normalized.toLowerCase().split("/").filter(Boolean);
  return segments.includes("private");
}

function extractMeta(path: string, content: string): DocSummary {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const heading = lines.find((line) => line.startsWith("#"));
  const title = heading ? heading.replace(/^#+\s*/, "").trim() : path;
  const bodyLine =
    lines.find((line) => !line.startsWith("#")) ?? "";
  const summary =
    bodyLine.length > 160 ? `${bodyLine.slice(0, 157)}…` : bodyLine;
  return { path, title, summary };
}

export function listDocs(): string[] {
  return Object.keys(PUBLIC_DOCS).sort();
}

export function describeDocs(): DocSummary[] {
  return listDocs().map((path) => extractMeta(path, PUBLIC_DOCS[path]));
}

function truncateContent(content: string): string {
  if (content.length <= MAX_READ_CHARS) return content;
  return `${content.slice(0, MAX_READ_CHARS)}\n\n[truncated]`;
}

function resolveDocPaths(rawPath: string): string[] {
  if (isBlockedPath(rawPath)) {
    throw new Error(`Unknown or blocked path: ${rawPath}`);
  }
  const rel = stripCandidatePrefix(rawPath);
  if (!rel) {
    return ["README.md"];
  }

  if (Object.hasOwn(PUBLIC_DOCS, rel)) {
    return [rel];
  }

  const withMd = rel.endsWith(".md") ? rel : `${rel}.md`;
  if (Object.hasOwn(PUBLIC_DOCS, withMd)) {
    return [withMd];
  }

  const allPaths = listDocs();
  const lowerRel = rel.toLowerCase();
  const lowerWithMd = withMd.toLowerCase();

  const caseExact = allPaths.find(
    (p) => p.toLowerCase() === lowerRel || p.toLowerCase() === lowerWithMd,
  );
  if (caseExact) {
    return [caseExact];
  }

  // Directory match: e.g. "projects" or "work/" returns all files in that folder.
  const folderPrefix = `${lowerRel}/`;
  const folderMatches = allPaths.filter((p) =>
    p.toLowerCase().startsWith(folderPrefix),
  );
  if (folderMatches.length > 0) {
    return folderMatches;
  }

  // Bare filename match: e.g. "google" or "infer.md" -> "work/google.md", "projects/infer.md".
  const baseMatches = allPaths.filter((p) => {
    const base = p.split("/").pop()?.toLowerCase() ?? "";
    const stem = base.replace(/\.md$/, "");
    return base === lowerWithMd || stem === lowerRel;
  });
  if (baseMatches.length > 0) {
    return baseMatches;
  }

  throw new Error(`Unknown or blocked path: ${rawPath}`);
}

export function readDoc(path: string):
  | { path: string; content: string }
  | { folder: string; files: DocContent[] } {
  const resolved = resolveDocPaths(path);
  if (resolved.length === 1) {
    const target = resolved[0];
    return {
      path: target,
      content: truncateContent(PUBLIC_DOCS[target]),
    };
  }
  return {
    folder: stripCandidatePrefix(path),
    files: resolved.map((target) => ({
      path: target,
      content: truncateContent(PUBLIC_DOCS[target]),
    })),
  };
}

export function readDocs(paths: string[]): {
  files: DocContent[];
  errors?: { path: string; error: string }[];
  availableFiles?: string[];
} {
  const seen = new Set<string>();
  const files: DocContent[] = [];
  const errors: { path: string; error: string }[] = [];

  for (const rawPath of paths) {
    try {
      const resolved = resolveDocPaths(rawPath);
      for (const target of resolved) {
        if (seen.has(target)) continue;
        seen.add(target);
        files.push({
          path: target,
          content: truncateContent(PUBLIC_DOCS[target]),
        });
      }
    } catch (err) {
      errors.push({
        path: rawPath,
        error: err instanceof Error ? err.message : "read failed",
      });
    }
  }

  return {
    files,
    ...(errors.length > 0
      ? { errors, availableFiles: listDocs() }
      : {}),
  };
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "about", "as", "at", "be", "been", "by", "can",
  "did", "do", "does", "erick", "erick's", "ericks", "for", "from", "give",
  "had", "has", "have", "he", "him", "his", "how", "i", "in", "into", "is",
  "it", "me", "more", "my", "of", "on", "or", "tell", "that", "the", "their",
  "them", "there", "these", "they", "this", "to", "up", "was", "what", "when",
  "where", "which", "who", "why", "with", "would", "you", "your",
]);

function stemToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length >= 1);
}

function expandTerms(tokens: string[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const raw of tokens) {
    if (STOP_WORDS.has(raw) && tokens.length > 1) continue;
    weights.set(raw, Math.max(weights.get(raw) ?? 0, 3));
    const stemmed = stemToken(raw);
    if (stemmed !== raw && stemmed.length >= 2) {
      weights.set(stemmed, Math.max(weights.get(stemmed) ?? 0, 2.2));
    }
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(raw) || group.includes(stemmed)) {
        for (const syn of group) {
          if (!weights.has(syn)) {
            weights.set(syn, 1.1);
          }
        }
      }
    }
  }
  if (weights.size === 0) {
    for (const raw of tokens) {
      weights.set(raw, 2);
    }
  }
  return weights;
}

function buildBestSnippet(content: string, terms: string[], rawPhrase: string): string {
  const clean = content.replace(/\r\n/g, "\n").trim();
  if (clean.length <= SNIPPET_CHARS) {
    return clean.replace(/\s+/g, " ");
  }

  const lower = clean.toLowerCase();
  if (rawPhrase.length >= 3) {
    const exactIdx = lower.indexOf(rawPhrase);
    if (exactIdx !== -1) {
      const start = Math.max(0, exactIdx - 100);
      return clean.slice(start, start + SNIPPET_CHARS).replace(/\s+/g, " ").trim();
    }
  }

  let bestStart = 0;
  let bestScore = -1;
  const step = 80;
  for (let pos = 0; pos < clean.length; pos += step) {
    const windowLower = lower.slice(pos, pos + SNIPPET_CHARS);
    let score = 0;
    for (const term of terms) {
      if (term.length >= 2 && windowLower.includes(term)) {
        score += term.length >= 4 ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = pos;
    }
  }

  return clean
    .slice(bestStart, bestStart + SNIPPET_CHARS)
    .replace(/\s+/g, " ")
    .trim();
}

export function searchDocs(query: string): SearchHit[] {
  const rawPhrase = query.trim().toLowerCase();
  if (!rawPhrase) return [];

  const queryTokens = tokenize(rawPhrase);
  const weightedTerms = expandTerms(queryTokens);
  const directTerms = queryTokens.filter((t) => !STOP_WORDS.has(t));

  const scored: { path: string; title: string; snippet: string; score: number }[] = [];

  for (const [path, content] of Object.entries(PUBLIC_DOCS)) {
    const meta = extractMeta(path, content);
    const pathLower = path.toLowerCase();
    const titleLower = meta.title.toLowerCase();
    const contentLower = content.toLowerCase();
    const docTokens = new Set(tokenize(`${path} ${content}`).map(stemToken));

    let score = 0;

    if (rawPhrase.length >= 2 && contentLower.includes(rawPhrase)) {
      score += 18;
    }
    if (rawPhrase.length >= 2 && (pathLower.includes(rawPhrase) || titleLower.includes(rawPhrase))) {
      score += 24;
    }

    let matchedDirect = 0;
    for (const dt of directTerms) {
      const stem = stemToken(dt);
      if (
        pathLower.includes(dt) ||
        titleLower.includes(dt) ||
        contentLower.includes(dt) ||
        docTokens.has(stem)
      ) {
        matchedDirect += 1;
      }
    }
    if (directTerms.length > 1 && matchedDirect > 1) {
      score += matchedDirect * 8;
    }

    for (const [term, weight] of weightedTerms.entries()) {
      if (term.length < 2 && term !== "c" && term !== "x") continue;

      if (term === "c" || term === "x") {
        const wordRe = new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`, "i");
        if (wordRe.test(titleLower) || wordRe.test(pathLower)) score += weight * 3;
        else if (wordRe.test(contentLower)) score += weight * 1.5;
        continue;
      }

      if (pathLower.includes(term)) {
        score += weight * 4;
      }
      if (titleLower.includes(term)) {
        score += weight * 3.5;
      }
      if (contentLower.includes(term)) {
        score += weight * 2;
      } else if (docTokens.has(stemToken(term))) {
        score += weight * 1.5;
      }
    }

    if (score <= 0) continue;

    scored.push({
      path,
      title: meta.title,
      snippet: buildBestSnippet(content, [...weightedTerms.keys()], rawPhrase),
      score,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, MAX_SEARCH_HITS)
    .map(({ path, title, snippet }) => ({ path, title, snippet }));
}
