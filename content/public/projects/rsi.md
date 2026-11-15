# TinyTrains / `lab` — RSI & Auto-research Harness

Repo: [github.com/eosterloh/lab](https://github.com/eosterloh/lab) · July–August 2026 · Python, PyTorch, LangSmith.

Long-running recursive self-improvement (RSI) / auto-research agent harness for an **8M-parameter** Llama-style model trained on TinyStories under a **3.5-day** compute budget.

## Loop & Safety Architecture
- **Phased loop**: `Eval (read-only) → Research (sandboxed web/code/data, budgeted) → Train (GPU-locked commit from a hashed pack) → Eval`.
- **Anti-reward-hacking promotion gate**: Frozen eval (`core v1`) and promotion are NOT policy tools. Promotion is gated on **`confirm_ppl`** (held-out perplexity on a frozen split the policy cannot write), alongside tune/OOD PPL and mini benchmark slices (HellaSwag, ARC-Easy, PIQA).
- **Hypothesis & Episode memory**: `enter_train` refuses until `hypothesis.json` (claim, falsification criteria, checklist) and a hashed pack are valid. Every completed cycle writes an episode card under `episodes/` and updates `beliefs.md`.
- **Constrained experimenter policy**: Runs an experimenter policy (default `Qwen3.8-27B`) through `infer` using byte-level JSON Schema constrained decoding so every turn emits a valid phase-scoped `{"tool", "args"}` call, traced locally to `trace.jsonl` (with optional LangSmith mirroring).
