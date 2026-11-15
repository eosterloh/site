# `infer` — From-Scratch Local Hybrid Inference Engine

Repo: [github.com/eosterloh/infer](https://github.com/eosterloh/infer) · July–August 2026 (ongoing) · Python, C++, CUDA, PyTorch.

Plug-and-play local inference engine built for agents and model experiments: drop in a HuggingFace checkpoint folder (`config.json` + safetensors or GGUF) and generate greedy or sampled tokens (`temperature`, `top_k`, `top_p`, `seed`) with exact greedy-decode logit parity against HuggingFace.

## Capabilities
- **30+ model families**: Dense, MoE, and hybrid SSM / DeltaNet architectures including Llama (1–4), Mistral / Mixtral, Qwen2 / Qwen3 / Qwen3.5 / Qwen3.8, DeepSeek V2/V3, Gemma 1–3, Phi 3/4, OLMo, Jamba (Mamba-1/2), Qwen Gated DeltaNet, and Nemotron-H (Nano + Super LatentMoE). North star: **Nemotron NVFP4 fused on DGX Spark**.
- **Multimodal & speculative decode**: Vision towers (Qwen2.5-VL / Qwen3.5, Gemma3, Llama 4, Mistral3) and native Multi-Token Prediction (MTP) draft layers.
- **Byte-level JSON Schema constrained decoding**: Pushdown JSON-schema matcher (`json_schema=` / `generate_json`) guaranteeing valid schema-conformant tool calls for agent loops like `lab`, with `last_json_stats` reporting whether token budget forced early closure.
- **Custom CUDA kernels on DGX Spark (`sm_121`)**: Custom `torch.ops.infer.*` extension (`rms_norm`, `fused_add_rms_norm`, `rope_inplace`, `act_mul`, `gemv` / `qgemv`, `dequant`, online-softmax `attn_decode`, `moe_gemv` / `qmoe_gemv`, `mamba2_scan`, `gdn_decode`), CUDA graph capture, and INT4 / NVFP4 / FP8 weight packing with automatic PyTorch fallback.
