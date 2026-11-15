# Dossier — Personal MCP & Site Context

Site repo: [github.com/eosterloh/site](https://github.com/eosterloh/site) · July 2026–present · Python (MCP server), Next.js + Vercel AI SDK (public web agent).

Personal MCP architecture: drop Markdown notes into `drop/public` and `drop/private` on a Python MCP server running on Spark (`:8765`). Private context requires a bearer token so personal agents can act with full context while keeping sensitive data gated. The public slice is bundled into [erickosterloh.com](https://erickosterloh.com) and queried via agentic search/read tools (`list_docs`, `search_docs`, `read_doc`, `read_docs`) through Vercel AI Gateway.
